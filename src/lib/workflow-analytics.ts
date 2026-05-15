import type { CrmData, Profile } from "@/lib/types";
import {
  agentOnboardingStatuses,
  merchantOnboardingStatuses,
  recruitStatuses,
} from "@/lib/workflow-constants";

export type ChartDatum = {
  name: string;
  value: number;
};

export type MonthlyWorkflowDatum = {
  month: string;
  recruits: number;
  merchants: number;
};

export function buildStatusSeries(
  values: { status: string }[],
  options: { value: string; label: string }[],
): ChartDatum[] {
  return options.map((option) => ({
    name: option.label,
    value: values.filter((item) => item.status === option.value).length,
  }));
}

export function calculateConversionRate(total: number, converted: number) {
  if (!total) return 0;
  return Math.round((converted / total) * 100);
}

export function calculateAgentOnboardingCompletion(data: CrmData) {
  if (!data.agentOnboardingRecords.length) return 0;

  const completed = data.agentOnboardingRecords.reduce(
    (sum, record) => sum + Number(record.training_progress || 0),
    0,
  );

  return Math.round(completed / data.agentOnboardingRecords.length);
}

export function buildMonthlyWorkflowSeries(data: CrmData, monthCount = 6): MonthlyWorkflowDatum[] {
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (monthCount - index - 1));
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-US", { month: "short" }),
    };
  });

  return months.map((month) => ({
    month: month.label,
    recruits: data.agentRecruits.filter((recruit) => recruit.created_at.slice(0, 7) === month.key).length,
    merchants: data.merchantOnboardingRecords.filter((record) => record.created_at.slice(0, 7) === month.key).length,
  }));
}

export function scopeCrmDataForProfile(data: CrmData, profile: Profile): CrmData {
  if (profile.role === "admin") return data;

  const visibleProfileIds = new Set<string>([profile.id]);
  if (profile.role === "manager") {
    data.profiles.filter((item) => item.manager_id === profile.id).forEach((item) => visibleProfileIds.add(item.id));
  }
  const visibleAgentIds = new Set(data.agents.filter((agent) => visibleProfileIds.has(agent.profile_id)).map((agent) => agent.id));
  const visibleMerchantIds = new Set(data.merchants.filter((merchant) => visibleAgentIds.has(merchant.assigned_agent_id)).map((merchant) => merchant.id));
  const visibleRecruitIds = new Set(
    data.agentRecruits
      .filter((recruit) => !recruit.assigned_recruiter_id || visibleProfileIds.has(recruit.assigned_recruiter_id))
      .map((recruit) => recruit.id),
  );
  const visibleTeamIds = new Set(
    data.teams
      .filter((team) => visibleAgentIds.has(team.leader_agent_id) || data.teamMembers.some((member) => member.team_id === team.id && visibleAgentIds.has(member.agent_id)))
      .map((team) => team.id),
  );

  return {
    ...data,
    profiles: data.profiles.filter((item) => visibleProfileIds.has(item.id)),
    agents: data.agents.filter((agent) => visibleAgentIds.has(agent.id)),
    merchants: data.merchants.filter((merchant) => visibleMerchantIds.has(merchant.id)),
    deals: data.deals.filter((deal) => visibleAgentIds.has(deal.agent_id) || visibleMerchantIds.has(deal.merchant_id)),
    merchantUpdates: data.merchantUpdates.filter((update) => visibleAgentIds.has(update.agent_id) || visibleMerchantIds.has(update.merchant_id)),
    tasks: data.tasks.filter((task) => visibleProfileIds.has(task.assigned_to) || (task.merchant_id ? visibleMerchantIds.has(task.merchant_id) : false)),
    documents: data.documents.filter((document) => visibleMerchantIds.has(document.merchant_id)),
    agentRecruits: data.agentRecruits.filter((recruit) => visibleRecruitIds.has(recruit.id)),
    agentRecruitUpdates: data.agentRecruitUpdates.filter((update) => visibleRecruitIds.has(update.recruit_id)),
    agentOnboardingRecords: data.agentOnboardingRecords.filter((record) => !record.profile_id || visibleProfileIds.has(record.profile_id)),
    merchantOnboardingRecords: data.merchantOnboardingRecords.filter(
      (record) => (record.assigned_agent_id ? visibleAgentIds.has(record.assigned_agent_id) : false) || (record.merchant_id ? visibleMerchantIds.has(record.merchant_id) : false),
    ),
    merchantOnboardingSteps: data.merchantOnboardingSteps.filter((step) =>
      data.merchantOnboardingRecords.some((record) => record.id === step.onboarding_id && ((record.assigned_agent_id ? visibleAgentIds.has(record.assigned_agent_id) : false) || (record.merchant_id ? visibleMerchantIds.has(record.merchant_id) : false))),
    ),
    residuals: data.residuals.filter((residual) => visibleAgentIds.has(residual.agent_id)),
    teams: data.teams.filter((team) => visibleTeamIds.has(team.id)),
    teamMembers: data.teamMembers.filter((member) => visibleTeamIds.has(member.team_id) || visibleAgentIds.has(member.agent_id) || visibleAgentIds.has(member.sponsor_agent_id)),
    recruitProgress: data.recruitProgress.filter((progress) => visibleRecruitIds.has(progress.recruit_id) || (progress.team_id ? visibleTeamIds.has(progress.team_id) : false)),
    payrollAdjustments: data.payrollAdjustments.filter((adjustment) => visibleAgentIds.has(adjustment.agent_id)),
    underwritingDecisions: data.underwritingDecisions.filter((decision) =>
      data.merchantOnboardingRecords.some((record) => record.id === decision.merchant_onboarding_id && ((record.assigned_agent_id ? visibleAgentIds.has(record.assigned_agent_id) : false) || (record.merchant_id ? visibleMerchantIds.has(record.merchant_id) : false))),
    ),
  };
}

export function buildWorkflowAnalytics(data: CrmData, profile?: Profile) {
  const scopedData = profile ? scopeCrmDataForProfile(data, profile) : data;
  const pendingFollowUps = [
    ...scopedData.tasks.filter((task) => task.status !== "completed"),
    ...scopedData.agentRecruits.filter((recruit) => recruit.follow_up_at),
    ...scopedData.merchantOnboardingRecords.filter((record) => record.follow_up_at),
  ].length;
  const activeRecruitPipeline = scopedData.agentRecruits.filter(
    (recruit) => !["active", "rejected"].includes(recruit.status),
  ).length;
  const activeMerchantPipeline = scopedData.merchantOnboardingRecords.filter(
    (record) => !["active", "declined"].includes(record.status),
  ).length;
  const approvedApplications = scopedData.merchantOnboardingRecords.filter((record) => record.status === "approved" || record.status === "active").length;
  const declinedApplications = scopedData.merchantOnboardingRecords.filter((record) => record.status === "declined").length;
  const payrollTotal = scopedData.residuals.reduce((sum, residual) => sum + residual.agent_residual_amount, 0) +
    scopedData.payrollAdjustments.filter((adjustment) => adjustment.status !== "void").reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const financialTotal = scopedData.residuals.reduce((sum, residual) => sum + residual.net_residual, 0);

  return {
    scope: profile?.role ?? "admin",
    scopedData,
    recruitStatus: buildStatusSeries(scopedData.agentRecruits, recruitStatuses),
    agentOnboardingStatus: buildStatusSeries(scopedData.agentOnboardingRecords, agentOnboardingStatuses),
    merchantOnboardingStatus: buildStatusSeries(scopedData.merchantOnboardingRecords, merchantOnboardingStatuses),
    monthlyWorkflow: buildMonthlyWorkflowSeries(scopedData),
    metrics: {
      totalAgents: scopedData.agents.length,
      activeAgents: scopedData.agents.filter((agent) => agent.status === "active").length,
      recruitsPerTeam: scopedData.teams.length ? Math.round(scopedData.agentRecruits.length / scopedData.teams.length) : scopedData.agentRecruits.length,
      totalRecruits: scopedData.agentRecruits.length,
      activeRecruitPipeline,
      recruitConversionRate: calculateConversionRate(
        scopedData.agentRecruits.length,
        scopedData.agentRecruits.filter((recruit) => recruit.status === "active").length,
      ),
      agentOnboardingCompletion: calculateAgentOnboardingCompletion(scopedData),
      totalMerchantOnboarding: scopedData.merchantOnboardingRecords.length,
      activeMerchantPipeline,
      merchantConversionRate: calculateConversionRate(
        scopedData.merchantOnboardingRecords.length,
        scopedData.merchantOnboardingRecords.filter((record) => record.status === "active").length,
      ),
      applicationCount: scopedData.merchantOnboardingRecords.length,
      approvalRate: calculateConversionRate(scopedData.merchantOnboardingRecords.length, approvedApplications),
      denialRate: calculateConversionRate(scopedData.merchantOnboardingRecords.length, declinedApplications),
      payrollTotal,
      financialTotal,
      pendingFollowUps,
    },
  };
}
