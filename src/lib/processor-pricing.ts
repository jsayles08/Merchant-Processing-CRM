import type {
  CompensationRule,
  CrmData,
  Merchant,
  ProcessorPricingSetting,
  Residual,
} from "@/lib/types";

export const legacyResidualShare = 0.28;

export const defaultProcessorPricingSettings: ProcessorPricingSetting[] = [
  {
    id: "default-fiserv-pricing",
    processor_key: "fiserv",
    processor_name: "Fiserv",
    pricing_unit: "basis_points",
    rate_value: 1.5,
    flat_fee: null,
    effective_at: "1970-01-01",
    is_active: true,
    notes: "Default Fiserv processor cost: 1.5 basis points.",
    created_by: null,
    updated_by: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "default-nuvei-pricing",
    processor_key: "nuvei",
    processor_name: "Nuvei",
    pricing_unit: "basis_points",
    rate_value: 2,
    flat_fee: null,
    effective_at: "1970-01-01",
    is_active: true,
    notes: "Default Nuvei placeholder pricing. Replace with production contract values.",
    created_by: null,
    updated_by: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

export type ProcessorPricingCalculationInput = {
  processingVolume: number;
  proposedRatePercent: number;
  processorName?: string | null;
  pricingSettings?: ProcessorPricingSetting[];
  effectiveDate?: string;
};

export type ProcessorPricingCalculation = {
  grossProcessingRevenue: number;
  processorCost: number;
  netResidual: number;
  legacyEstimatedResidual: number;
  appliedSetting: ProcessorPricingSetting | null;
  pricingSource: "configured" | "default" | "legacy";
  rateLabel: string;
};

export function normalizeProcessorKey(value?: string | null) {
  return (value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

export function hydrateProcessorPricingSettings(settings: ProcessorPricingSetting[] = []) {
  const rows = [...settings];
  const existingKeys = new Set(rows.map((setting) => setting.processor_key));
  for (const fallback of defaultProcessorPricingSettings) {
    if (!existingKeys.has(fallback.processor_key)) rows.push(fallback);
  }
  return rows.sort((a, b) => b.effective_at.localeCompare(a.effective_at));
}

export function findActiveProcessorPricing(
  settings: ProcessorPricingSetting[] = [],
  processorName?: string | null,
  effectiveDate = new Date().toISOString().slice(0, 10),
) {
  const processorKey = normalizeProcessorKey(processorName);
  const active = hydrateProcessorPricingSettings(settings)
    .filter((setting) => setting.is_active)
    .filter((setting) => setting.processor_key === processorKey)
    .filter((setting) => setting.effective_at.slice(0, 10) <= effectiveDate.slice(0, 10))
    .sort((a, b) => {
      const dateCompare = b.effective_at.localeCompare(a.effective_at);
      return dateCompare || b.updated_at.localeCompare(a.updated_at);
    });

  return active[0] ?? null;
}

export function calculateProcessorFee(input: ProcessorPricingCalculationInput): ProcessorPricingCalculation {
  const grossProcessingRevenue = roundCurrency(input.processingVolume * (input.proposedRatePercent / 100));
  const legacyEstimatedResidual = roundCurrency(grossProcessingRevenue * legacyResidualShare);
  const setting = findActiveProcessorPricing(input.pricingSettings, input.processorName, input.effectiveDate);

  if (!setting) {
    return {
      grossProcessingRevenue,
      processorCost: roundCurrency(Math.max(grossProcessingRevenue - legacyEstimatedResidual, 0)),
      netResidual: legacyEstimatedResidual,
      legacyEstimatedResidual,
      appliedSetting: null,
      pricingSource: "legacy",
      rateLabel: "Legacy 28% estimate",
    };
  }

  const processorCost = roundCurrency(calculateProcessorCost(input.processingVolume, grossProcessingRevenue, setting));
  return {
    grossProcessingRevenue,
    processorCost,
    netResidual: roundCurrency(Math.max(grossProcessingRevenue - processorCost, 0)),
    legacyEstimatedResidual,
    appliedSetting: setting,
    pricingSource: setting.id.startsWith("default-") ? "default" : "configured",
    rateLabel: formatProcessorPricing(setting),
  };
}

export function calculateProcessorCost(volume: number, grossProcessingRevenue: number, setting: ProcessorPricingSetting) {
  const flatFee = Number(setting.flat_fee ?? 0);
  switch (setting.pricing_unit) {
    case "basis_points":
      return volume * (setting.rate_value / 10000);
    case "basis_points_plus_flat":
      return volume * (setting.rate_value / 10000) + flatFee;
    case "percentage":
      return grossProcessingRevenue * (setting.rate_value / 100);
    case "percentage_plus_flat":
      return grossProcessingRevenue * (setting.rate_value / 100) + flatFee;
    case "flat_fee":
      return flatFee || setting.rate_value;
    default:
      return 0;
  }
}

export function calculateResidualBreakdown(params: {
  processingVolume: number;
  proposedRatePercent: number;
  processorName?: string | null;
  pricingSettings?: ProcessorPricingSetting[];
  compensationRule: CompensationRule;
  effectiveDate?: string;
}) {
  const calculation = calculateProcessorFee(params);
  const agentResidualAmount = roundCurrency(calculation.netResidual * (params.compensationRule.base_residual_percentage / 100));
  return {
    ...calculation,
    agentResidualAmount,
    companyShare: roundCurrency(calculation.netResidual - agentResidualAmount),
    pricingSnapshot: buildProcessorPricingSnapshot(calculation),
  };
}

export function recalculateResidualRow(params: {
  residual: Residual;
  merchant: Merchant;
  pricingSettings: ProcessorPricingSetting[];
  compensationRule: CompensationRule;
}) {
  const breakdown = calculateResidualBreakdown({
    processingVolume: params.residual.processing_volume,
    proposedRatePercent: params.merchant.proposed_rate,
    processorName: params.merchant.current_processor,
    pricingSettings: params.pricingSettings,
    compensationRule: params.compensationRule,
    effectiveDate: params.residual.month,
  });

  return {
    gross_processing_revenue: breakdown.grossProcessingRevenue,
    processor_cost: breakdown.processorCost,
    net_residual: breakdown.netResidual,
    agent_residual_amount: breakdown.agentResidualAmount,
    company_share: breakdown.companyShare,
    processor_pricing_setting_id: breakdown.appliedSetting?.id.startsWith("default-") ? null : breakdown.appliedSetting?.id ?? null,
    processor_pricing_snapshot: breakdown.pricingSnapshot,
    recalculated_at: new Date().toISOString(),
  };
}

export function shouldProtectResidualFromRecalculation(data: CrmData, residual: Residual) {
  if (residual.calculation_locked) return true;
  const exportCutoff = data.payrollExports
    .map((payrollExport) => String(payrollExport.filters?.dateTo ?? ""))
    .filter(Boolean)
    .sort()
    .at(-1);

  return Boolean(exportCutoff && residual.month.slice(0, 10) <= exportCutoff);
}

export function formatProcessorPricing(setting: Pick<ProcessorPricingSetting, "pricing_unit" | "rate_value" | "flat_fee">) {
  const rate = Number(setting.rate_value || 0);
  const flat = Number(setting.flat_fee || 0);
  const flatLabel = flat ? ` + ${formatMoney(flat)} flat` : "";
  if (setting.pricing_unit === "basis_points" || setting.pricing_unit === "basis_points_plus_flat") {
    return `${rate} bps${flatLabel}`;
  }
  if (setting.pricing_unit === "percentage" || setting.pricing_unit === "percentage_plus_flat") {
    return `${rate}%${flatLabel}`;
  }
  return `${formatMoney(flat || rate)} flat`;
}

export function buildProcessorPricingSnapshot(calculation: ProcessorPricingCalculation) {
  return {
    pricing_source: calculation.pricingSource,
    setting_id: calculation.appliedSetting?.id ?? null,
    processor_key: calculation.appliedSetting?.processor_key ?? null,
    processor_name: calculation.appliedSetting?.processor_name ?? null,
    pricing_unit: calculation.appliedSetting?.pricing_unit ?? null,
    rate_value: calculation.appliedSetting?.rate_value ?? null,
    flat_fee: calculation.appliedSetting?.flat_fee ?? null,
    rate_label: calculation.rateLabel,
  };
}

export function buildProcessorPricingAuditMetadata(input: {
  previous?: ProcessorPricingSetting | null;
  next: Pick<ProcessorPricingSetting, "processor_key" | "processor_name" | "pricing_unit" | "rate_value" | "flat_fee" | "effective_at" | "is_active" | "notes">;
  recalculationTriggered?: boolean;
}) {
  return {
    processor_key: input.next.processor_key,
    processor_name: input.next.processor_name,
    old_value: input.previous
      ? {
          pricing_unit: input.previous.pricing_unit,
          rate_value: input.previous.rate_value,
          flat_fee: input.previous.flat_fee,
          effective_at: input.previous.effective_at,
          is_active: input.previous.is_active,
          notes: input.previous.notes,
        }
      : null,
    new_value: {
      pricing_unit: input.next.pricing_unit,
      rate_value: input.next.rate_value,
      flat_fee: input.next.flat_fee,
      effective_at: input.next.effective_at,
      is_active: input.next.is_active,
      notes: input.next.notes,
    },
    recalculation_triggered: Boolean(input.recalculationTriggered),
  };
}

export function roundCurrency(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(value: number) {
  return `$${roundCurrency(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
