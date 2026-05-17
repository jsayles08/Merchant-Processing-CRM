import type { Agent, CrmData, Profile } from "@/lib/types";

export type AgentDirectoryRow = {
  profile: Profile;
  agent: Agent | null;
  manager: Profile | null;
  sponsor: Agent | null;
  sponsorProfile: Profile | null;
  sponsoredAgentCount: number;
  merchantCount: number;
  dealCount: number;
  taskCount: number;
  canHardDelete: boolean;
};

export function buildAgentDirectory(data: CrmData): AgentDirectoryRow[] {
  return data.profiles
    .filter((profile) => profile.role === "agent" || data.agents.some((agent) => agent.profile_id === profile.id))
    .map((profile) => {
      const agent = data.agents.find((item) => item.profile_id === profile.id) ?? null;
      const sponsor = agent?.sponsor_agent_id
        ? data.agents.find((item) => item.id === agent.sponsor_agent_id) ?? null
        : null;
      const sponsorProfile = sponsor
        ? data.profiles.find((item) => item.id === sponsor.profile_id) ?? null
        : null;
      const merchantCount = agent ? data.merchants.filter((merchant) => merchant.assigned_agent_id === agent.id).length : 0;
      const dealCount = agent ? data.deals.filter((deal) => deal.agent_id === agent.id).length : 0;
      const taskCount = data.tasks.filter((task) => task.assigned_to === profile.id).length;
      const sponsoredAgentCount = agent ? data.agents.filter((item) => item.sponsor_agent_id === agent.id).length : 0;

      return {
        profile,
        agent,
        manager: profile.manager_id ? data.profiles.find((item) => item.id === profile.manager_id) ?? null : null,
        sponsor,
        sponsorProfile,
        sponsoredAgentCount,
        merchantCount,
        dealCount,
        taskCount,
        canHardDelete: merchantCount + dealCount + taskCount + sponsoredAgentCount === 0,
      };
    })
    .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));
}

export function buildSuggestedAgentCode(fullName: string, existingCodes: string[], suffix = Date.now().toString().slice(-4)) {
  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "AG";
  const baseCode = `MD-${initials}-${suffix}`;
  if (!existingCodes.includes(baseCode)) return baseCode;

  let counter = 2;
  while (existingCodes.includes(`${baseCode}-${counter}`)) {
    counter += 1;
  }

  return `${baseCode}-${counter}`;
}
