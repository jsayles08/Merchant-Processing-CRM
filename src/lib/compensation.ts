import type { Agent, CompensationRule, Merchant, Residual, TeamMember } from "@/lib/types";
import { daysBetween } from "@/lib/utils";

export function requiresManagementApproval(proposedRate: number, minimumRate = 1.5) {
  return proposedRate < minimumRate;
}

export function calculatePersonalResidual(netResidual: number, baseResidualPercentage = 40) {
  return netResidual * (baseResidualPercentage / 100);
}

export function isActiveRecruit(
  recruit: Agent,
  merchants: Merchant[],
  rule: CompensationRule,
  today = new Date(),
) {
  const qualifiedMerchants = merchants.filter((merchant) => {
    if (merchant.assigned_agent_id !== recruit.id || !merchant.is_verified || !merchant.processing_start_date) {
      return false;
    }

    return daysBetween(merchant.processing_start_date, today) >= rule.active_recruit_required_processing_days;
  });

  return qualifiedMerchants.length >= rule.active_recruit_required_merchants;
}

export function calculateTeamOverridePercentage(teamMembers: TeamMember[], rule: CompensationRule) {
  const activeRecruitCount = teamMembers.filter((member) => member.active_recruit_status).length;
  return Math.min(
    activeRecruitCount * rule.override_per_active_recruit,
    rule.max_override_per_team,
  );
}

export function calculateTeamOverrideEarnings(
  sponsoredAgentIds: string[],
  residuals: Residual[],
  overridePercentage: number,
) {
  const sponsoredNetResidual = residuals
    .filter((residual) => sponsoredAgentIds.includes(residual.agent_id))
    .reduce((sum, residual) => sum + residual.net_residual, 0);

  return sponsoredNetResidual * (overridePercentage / 100);
}

export function calculateMonthlyAgentIncome(params: {
  agentId: string;
  residuals: Residual[];
  teamMembers: TeamMember[];
  compensationRule: CompensationRule;
}) {
  const personalNetResidual = params.residuals
    .filter((residual) => residual.agent_id === params.agentId)
    .reduce((sum, residual) => sum + residual.net_residual, 0);

  const personalResidualIncome = calculatePersonalResidual(
    personalNetResidual,
    params.compensationRule.base_residual_percentage,
  );

  const sponsoredAgentIds = params.teamMembers.map((member) => member.agent_id);
  const overridePercentage = calculateTeamOverridePercentage(params.teamMembers, params.compensationRule);
  const teamOverrideEarnings = calculateTeamOverrideEarnings(
    sponsoredAgentIds,
    params.residuals,
    overridePercentage,
  );

  const totalMonthlyIncome = personalResidualIncome + teamOverrideEarnings;

  return {
    personalNetResidual,
    personalResidualIncome,
    overridePercentage,
    teamOverrideEarnings,
    totalMonthlyIncome,
    annualizedIncomeEstimate: totalMonthlyIncome * 12,
  };
}
