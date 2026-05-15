import type { AgentRecruit, CrmData, RecruitStatus, Team } from "@/lib/types";

export const defaultTeamRecruitLimit = 4;

export function getTeamCapacity(data: CrmData, team: Team, limit = defaultTeamRecruitLimit) {
  const leader = data.agents.find((agent) => agent.id === team.leader_agent_id);
  const activeMembers = data.teamMembers.filter((member) => member.team_id === team.id);
  const pipelineRecruits = data.agentRecruits.filter(
    (recruit) =>
      recruit.assigned_recruiter_id === leader?.profile_id &&
      !["active", "rejected"].includes(recruit.status),
  );
  const used = activeMembers.length + pipelineRecruits.length;

  return {
    limit,
    used,
    available: Math.max(limit - used, 0),
    isFull: used >= limit,
    activeMembers,
    pipelineRecruits,
  };
}

export function canAssignRecruitToTeam(data: CrmData, team: Team, recruit: AgentRecruit, limit = defaultTeamRecruitLimit) {
  const capacity = getTeamCapacity(data, team, limit);
  const alreadyAssigned = capacity.pipelineRecruits.some((item) => item.id === recruit.id);
  return {
    ok: alreadyAssigned || !capacity.isFull,
    reason: alreadyAssigned ? "Recruit is already assigned to this team." : capacity.isFull ? `This team already has ${limit} recruits or active team members.` : null,
    capacity,
  };
}

export function progressForRecruitStatus(status: RecruitStatus) {
  const map: Record<RecruitStatus, number> = {
    new_lead: 10,
    contacted: 25,
    interested: 45,
    application_started: 65,
    onboarding: 82,
    active: 100,
    rejected: 0,
  };
  return map[status];
}

export function buildTeamMetrics(data: CrmData, team: Team) {
  const capacity = getTeamCapacity(data, team);
  const activeRecruitCount = capacity.activeMembers.filter((member) => member.active_recruit_status).length;
  const convertedPipeline = capacity.pipelineRecruits.filter((recruit) => recruit.status === "active").length;
  const totalTracked = capacity.activeMembers.length + capacity.pipelineRecruits.length;

  return {
    ...capacity,
    activeRecruitCount,
    conversionRate: totalTracked ? Math.round(((activeRecruitCount + convertedPipeline) / totalTracked) * 100) : 0,
  };
}
