import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import {
  buildProcessorPricingAuditMetadata,
  calculateProcessorFee,
  calculateResidualBreakdown,
  findActiveProcessorPricing,
  recalculateResidualRow,
  shouldProtectResidualFromRecalculation,
} from "@/lib/processor-pricing";
import type { CompensationRule, Merchant, ProcessorPricingSetting, Residual } from "@/lib/types";

const rule: CompensationRule = {
  id: "rule-test",
  rule_name: "Test rule",
  base_residual_percentage: 40,
  minimum_processing_rate: 1.5,
  override_per_active_recruit: 0.25,
  max_override_per_team: 1,
  active_recruit_required_merchants: 2,
  active_recruit_required_processing_days: 90,
  created_at: "2026-01-01T00:00:00.000Z",
};

function setting(input: Partial<ProcessorPricingSetting>): ProcessorPricingSetting {
  return {
    id: "pricing-test",
    processor_key: "fiserv",
    processor_name: "Fiserv",
    pricing_unit: "basis_points",
    rate_value: 1.5,
    flat_fee: null,
    effective_at: "2026-01-01",
    is_active: true,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

describe("processor pricing", () => {
  it("uses the default Fiserv 1.5 basis point cost when no database row exists", () => {
    const result = calculateProcessorFee({
      processingVolume: 100000,
      proposedRatePercent: 2,
      processorName: "Fiserv",
      pricingSettings: [],
    });

    expect(result.grossProcessingRevenue).toBe(2000);
    expect(result.processorCost).toBe(15);
    expect(result.netResidual).toBe(1985);
    expect(result.pricingSource).toBe("default");
    expect(result.rateLabel).toBe("1.5 bps");
  });

  it("calculates percentage plus flat processor pricing correctly", () => {
    const result = calculateProcessorFee({
      processingVolume: 50000,
      proposedRatePercent: 2,
      processorName: "Nuvei",
      pricingSettings: [
        setting({
          id: "pricing-nuvei",
          processor_key: "nuvei",
          processor_name: "Nuvei",
          pricing_unit: "percentage_plus_flat",
          rate_value: 10,
          flat_fee: 25,
        }),
      ],
    });

    expect(result.grossProcessingRevenue).toBe(1000);
    expect(result.processorCost).toBe(125);
    expect(result.netResidual).toBe(875);
    expect(result.rateLabel).toBe("10% + $25.00 flat");
  });

  it("selects the active effective-date pricing version", () => {
    const active = findActiveProcessorPricing(
      [
        setting({ id: "old", rate_value: 1, effective_at: "2026-01-01" }),
        setting({ id: "future", rate_value: 5, effective_at: "2026-06-01" }),
        setting({ id: "inactive", rate_value: 9, effective_at: "2026-03-01", is_active: false }),
      ],
      "Fiserv",
      "2026-05-01",
    );

    expect(active?.id).toBe("old");
    expect(active?.rate_value).toBe(1);
  });

  it("recalculates residual rows with the applied processor pricing snapshot", () => {
    const merchant: Merchant = {
      ...demoData.merchants[0],
      monthly_volume_estimate: 100000,
      proposed_rate: 2,
      current_processor: "Fiserv",
    };
    const residual: Residual = {
      ...demoData.residuals[0],
      merchant_id: merchant.id,
      processing_volume: 100000,
      month: "2026-04-01",
    };

    const patch = recalculateResidualRow({
      residual,
      merchant,
      pricingSettings: [],
      compensationRule: rule,
    });

    expect(patch.gross_processing_revenue).toBe(2000);
    expect(patch.processor_cost).toBe(15);
    expect(patch.net_residual).toBe(1985);
    expect(patch.agent_residual_amount).toBe(794);
    expect(patch.processor_pricing_snapshot).toMatchObject({
      pricing_source: "default",
      processor_key: "fiserv",
      rate_label: "1.5 bps",
    });
  });

  it("protects locked or exported residuals from automatic recalculation", () => {
    const lockedResidual = { ...demoData.residuals[0], calculation_locked: true };
    const exportedResidual = { ...demoData.residuals[0], calculation_locked: false, month: "2026-04-01" };
    const data = {
      ...demoData,
      payrollExports: [
        {
          id: "payroll-export-test",
          requested_by: "profile-admin",
          export_format: "csv" as const,
          filters: { dateTo: "2026-04-30" },
          row_count: 1,
          gross_commissions: 0,
          adjustments_total: 0,
          total_payout: 0,
          status: "generated" as const,
          provider: null,
          created_at: "2026-05-01T00:00:00.000Z",
        },
      ],
    };

    expect(shouldProtectResidualFromRecalculation(demoData, lockedResidual)).toBe(true);
    expect(shouldProtectResidualFromRecalculation(data, exportedResidual)).toBe(true);
  });

  it("records old and new values in pricing audit metadata", () => {
    const previous = setting({ rate_value: 1.5 });
    const next = setting({ rate_value: 2, notes: "Contract update" });
    const metadata = buildProcessorPricingAuditMetadata({ previous, next, recalculationTriggered: true });

    expect(metadata.old_value?.rate_value).toBe(1.5);
    expect(metadata.new_value.rate_value).toBe(2);
    expect(metadata.recalculation_triggered).toBe(true);
  });

  it("calculates agent payout from centralized residual math", () => {
    const result = calculateResidualBreakdown({
      processingVolume: 25000,
      proposedRatePercent: 2,
      processorName: "Fiserv",
      pricingSettings: [],
      compensationRule: rule,
    });

    expect(result.agentResidualAmount).toBe(198.5);
    expect(result.companyShare).toBe(297.75);
  });
});
