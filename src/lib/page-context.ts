import { getSessionContext } from "@/lib/auth";
import { getCrmData } from "@/lib/data";

export async function getCrmPageContext() {
  const { supabase, profile } = await getSessionContext();
  const data = await getCrmData(supabase);
  const currentAgent = data.agents.find((agent) => agent.profile_id === profile.id) ?? data.agents[0];

  return {
    supabase,
    profile,
    data,
    currentAgent,
    currentAgentId: currentAgent?.id ?? "",
  };
}
