import { toCsv } from "@/lib/csv";
import { calculateProcessorFee } from "@/lib/processor-pricing";
import type { CrmData, ExportFormat } from "@/lib/types";

export type FinancialExportFilters = {
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
  teamId?: string;
  status?: string;
  processor?: string;
  format?: ExportFormat;
};

export type FinancialExportRow = {
  statement_month: string;
  agent_name: string;
  agent_email: string;
  agent_code: string;
  team_number: number | "";
  merchant_name: string;
  merchant_status: string;
  processor: string;
  processing_volume: number;
  gross_processing_revenue: number;
  processor_cost: number;
  net_residual: number;
  agent_payout: number;
  company_share: number;
  processor_pricing_source: string;
  processor_rate: string;
};

export function generateFinancialExport(data: CrmData, filters: FinancialExportFilters = {}) {
  const rows = buildFinancialExportRows(data, filters);
  const totals = rows.reduce(
    (sum, row) => ({
      processingVolume: sum.processingVolume + row.processing_volume,
      grossProcessingRevenue: sum.grossProcessingRevenue + row.gross_processing_revenue,
      processorCost: sum.processorCost + row.processor_cost,
      netResidual: sum.netResidual + row.net_residual,
      agentPayout: sum.agentPayout + row.agent_payout,
      companyShare: sum.companyShare + row.company_share,
    }),
    { processingVolume: 0, grossProcessingRevenue: 0, processorCost: 0, netResidual: 0, agentPayout: 0, companyShare: 0 },
  );

  const csvRows = [
    ...rows,
    {
      statement_month: "TOTAL",
      agent_name: "",
      agent_email: "",
      agent_code: "",
      team_number: "",
      merchant_name: "",
      merchant_status: "",
      processor: "",
      processing_volume: roundCurrency(totals.processingVolume),
      gross_processing_revenue: roundCurrency(totals.grossProcessingRevenue),
      processor_cost: roundCurrency(totals.processorCost),
      net_residual: roundCurrency(totals.netResidual),
      agent_payout: roundCurrency(totals.agentPayout),
      company_share: roundCurrency(totals.companyShare),
      processor_pricing_source: "",
      processor_rate: "",
    },
  ];

  return {
    rows,
    totals: {
      processingVolume: roundCurrency(totals.processingVolume),
      grossProcessingRevenue: roundCurrency(totals.grossProcessingRevenue),
      processorCost: roundCurrency(totals.processorCost),
      netResidual: roundCurrency(totals.netResidual),
      agentPayout: roundCurrency(totals.agentPayout),
      companyShare: roundCurrency(totals.companyShare),
    },
    csv: toCsv(csvRows),
    filename: `merchantdesk-cpa-export-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

export function buildFinancialExportRows(data: CrmData, filters: FinancialExportFilters = {}): FinancialExportRow[] {
  const teamAgentIds = filters.teamId
    ? new Set([
        ...data.teamMembers.filter((member) => member.team_id === filters.teamId).map((member) => member.agent_id),
        ...data.teams.filter((team) => team.id === filters.teamId).map((team) => team.leader_agent_id),
      ])
    : null;

  return data.residuals
    .filter((residual) => isWithinDateRange(residual.month, filters.dateFrom, filters.dateTo))
    .filter((residual) => !filters.agentId || residual.agent_id === filters.agentId)
    .filter((residual) => !teamAgentIds || teamAgentIds.has(residual.agent_id))
    .map((residual) => {
      const merchant = data.merchants.find((item) => item.id === residual.merchant_id);
      const agent = data.agents.find((item) => item.id === residual.agent_id);
      const profile = data.profiles.find((item) => item.id === agent?.profile_id);
      return { residual, merchant, agent, profile };
    })
    .filter(({ merchant }) => !filters.status || merchant?.status === filters.status)
    .filter(({ merchant }) => !filters.processor || (merchant?.current_processor ?? "").toLowerCase() === filters.processor?.toLowerCase())
    .map(({ residual, merchant, agent, profile }) => {
      const processorCalculation = merchant
        ? calculateProcessorFee({
            processingVolume: residual.processing_volume,
            proposedRatePercent: merchant.proposed_rate,
            processorName: merchant.current_processor,
            pricingSettings: data.processorPricingSettings,
            effectiveDate: residual.month,
          })
        : null;
      const snapshot = residual.processor_pricing_snapshot ?? {};

      return {
        statement_month: residual.month,
        agent_name: profile?.full_name ?? agent?.agent_code ?? "Unknown agent",
        agent_email: profile?.email ?? "",
        agent_code: agent?.agent_code ?? "",
        team_number: agent?.team_number ?? "",
        merchant_name: merchant?.business_name ?? "Unknown merchant",
        merchant_status: merchant?.status ?? "",
        processor: merchant?.current_processor ?? "",
        processing_volume: roundCurrency(residual.processing_volume),
        gross_processing_revenue: roundCurrency(
          residual.gross_processing_revenue ?? processorCalculation?.grossProcessingRevenue ?? residual.net_residual,
        ),
        processor_cost: roundCurrency(residual.processor_cost ?? processorCalculation?.processorCost ?? 0),
        net_residual: roundCurrency(residual.net_residual),
        agent_payout: roundCurrency(residual.agent_residual_amount),
        company_share: roundCurrency(residual.company_share),
        processor_pricing_source: stringFromSnapshot(snapshot, "pricing_source") ?? processorCalculation?.pricingSource ?? "stored",
        processor_rate: stringFromSnapshot(snapshot, "rate_label") ?? processorCalculation?.rateLabel ?? "Stored residual",
      };
    });
}

export function buildExportAuditSummary(kind: "financial" | "payroll", rowCount: number, filters: Record<string, unknown>) {
  return {
    row_count: rowCount,
    filters,
    generated_at: new Date().toISOString(),
    export_kind: kind,
  };
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

function stringFromSnapshot(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" ? value : null;
}
