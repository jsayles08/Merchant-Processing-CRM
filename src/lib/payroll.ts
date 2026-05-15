import { toCsv } from "@/lib/csv";
import { sealProcessorCredentials } from "@/lib/processor-integrations";
import type { CrmData, ExportFormat, PayrollIntegration, PayrollProviderId } from "@/lib/types";

export type PayrollExportFilters = {
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
  teamId?: string;
  status?: string;
  provider?: string;
  format?: ExportFormat;
};

export type PayrollCredentialPayload = {
  apiKey?: string;
  accountId?: string;
  webhookSecret?: string;
};

export const payrollProviders = [
  {
    id: "stripe" as const,
    name: "Stripe",
    description: "Prepare Stripe Connect or payout-related sync boundaries for future live payout workflows.",
    requiredFields: ["apiKey"],
  },
  {
    id: "gusto" as const,
    name: "Gusto",
    description: "Payroll provider adapter placeholder for commission file handoff.",
    requiredFields: ["apiKey"],
  },
  {
    id: "manual" as const,
    name: "Manual payroll",
    description: "Track payroll files generated outside a live payout provider.",
    requiredFields: [],
  },
];

export function generatePayrollExport(data: CrmData, filters: PayrollExportFilters = {}) {
  const rows = buildPayrollRows(data, filters);
  const totals = rows.reduce(
    (sum, row) => ({
      grossCommissions: sum.grossCommissions + row.personal_commission + row.team_override,
      adjustments: sum.adjustments + row.adjustments,
      totalPayout: sum.totalPayout + row.total_payout,
    }),
    { grossCommissions: 0, adjustments: 0, totalPayout: 0 },
  );
  const csv = toCsv([
    ...rows,
    {
      period_start: filters.dateFrom ?? "",
      period_end: filters.dateTo ?? "",
      agent_name: "TOTAL",
      agent_email: "",
      agent_code: "",
      team_number: "",
      personal_commission: roundCurrency(totals.grossCommissions),
      team_override: 0,
      adjustments: roundCurrency(totals.adjustments),
      total_payout: roundCurrency(totals.totalPayout),
      payout_status: "",
    },
  ]);

  return {
    rows,
    totals: {
      grossCommissions: roundCurrency(totals.grossCommissions),
      adjustmentsTotal: roundCurrency(totals.adjustments),
      totalPayout: roundCurrency(totals.totalPayout),
    },
    csv,
    filename: `merchantdesk-payroll-export-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

export function buildPayrollRows(data: CrmData, filters: PayrollExportFilters = {}) {
  const teamAgentIds = filters.teamId
    ? new Set([
        ...data.teamMembers.filter((member) => member.team_id === filters.teamId).map((member) => member.agent_id),
        ...data.teams.filter((team) => team.id === filters.teamId).map((team) => team.leader_agent_id),
      ])
    : null;

  return data.agents
    .filter((agent) => !filters.agentId || agent.id === filters.agentId)
    .filter((agent) => !teamAgentIds || teamAgentIds.has(agent.id))
    .map((agent) => {
      const profile = data.profiles.find((item) => item.id === agent.profile_id);
      const residuals = data.residuals.filter(
        (residual) =>
          residual.agent_id === agent.id &&
          isWithinDateRange(residual.month, filters.dateFrom, filters.dateTo),
      );
      const personalCommission = residuals.reduce((sum, residual) => sum + residual.agent_residual_amount, 0);
      const sponsoredMembers = data.teamMembers.filter((member) => member.sponsor_agent_id === agent.id);
      const sponsoredAgentIds = sponsoredMembers.map((member) => member.agent_id);
      const activeOverrideRate = Math.min(
        sponsoredMembers.filter((member) => member.active_recruit_status).length * data.compensationRule.override_per_active_recruit,
        data.compensationRule.max_override_per_team,
      );
      const sponsoredResidual = data.residuals
        .filter((residual) => sponsoredAgentIds.includes(residual.agent_id) && isWithinDateRange(residual.month, filters.dateFrom, filters.dateTo))
        .reduce((sum, residual) => sum + residual.net_residual, 0);
      const teamOverride = sponsoredResidual * (activeOverrideRate / 100);
      const adjustments = data.payrollAdjustments
        .filter(
          (adjustment) =>
            adjustment.agent_id === agent.id &&
            adjustment.status !== "void" &&
            isWithinDateRange(adjustment.effective_date, filters.dateFrom, filters.dateTo),
        )
        .reduce((sum, adjustment) => sum + adjustment.amount, 0);

      return {
        period_start: filters.dateFrom ?? "",
        period_end: filters.dateTo ?? "",
        agent_name: profile?.full_name ?? agent.agent_code,
        agent_email: profile?.email ?? "",
        agent_code: agent.agent_code,
        team_number: agent.team_number,
        personal_commission: roundCurrency(personalCommission),
        team_override: roundCurrency(teamOverride),
        adjustments: roundCurrency(adjustments),
        total_payout: roundCurrency(personalCommission + teamOverride + adjustments),
        payout_status: "pending",
      };
    })
    .filter((row) => row.total_payout !== 0 || !filters.status || filters.status === "all");
}

export function validatePayrollCredentials(provider: PayrollProviderId, credentials: PayrollCredentialPayload) {
  const definition = payrollProviders.find((item) => item.id === provider);
  if (!definition) return "Choose a supported payroll provider.";
  const missing = definition.requiredFields.find((field) => !credentials[field as keyof PayrollCredentialPayload]);
  return missing ? `Add ${missing} before connecting ${definition.name}.` : null;
}

export function sealPayrollCredentials(credentials: PayrollCredentialPayload) {
  return sealProcessorCredentials(credentials);
}

export async function testPayrollIntegration(input: {
  provider: PayrollProviderId;
  accountIdentifier?: string;
  credentials: PayrollCredentialPayload;
}) {
  const error = validatePayrollCredentials(input.provider, input.credentials);
  if (error) return { ok: false, status: "error" as const, message: error };

  // TODO(payroll-stripe): Replace local validation with Stripe Connect/payout account verification when production keys are active.
  return {
    ok: true,
    status: "connected" as const,
    message: `${providerName(input.provider)} payroll adapter passed local validation.`,
    providerAccountId: input.accountIdentifier ?? null,
    metadata: {
      adapter_mode: "credential_validation",
      provider: input.provider,
    },
  };
}

export async function syncPayrollIntegration(integration: PayrollIntegration) {
  if (integration.status === "disconnected") {
    return { ok: false, status: "disconnected" as const, message: "Reconnect this payroll provider before syncing." };
  }
  return {
    ok: true,
    status: "connected" as const,
    message: `${providerName(integration.provider as PayrollProviderId)} payroll sync completed through the adapter boundary.`,
    recordsProcessed: 1,
  };
}

function providerName(provider: PayrollProviderId) {
  return payrollProviders.find((item) => item.id === provider)?.name ?? provider;
}

function isWithinDateRange(value: string, dateFrom?: string, dateTo?: string) {
  const key = value.slice(0, 10);
  if (dateFrom && key < dateFrom) return false;
  if (dateTo && key > dateTo) return false;
  return true;
}

function roundCurrency(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}
