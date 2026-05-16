import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import { generateFinancialExport } from "@/lib/finance-export";

describe("financial exports", () => {
  it("generates CPA-ready CSV rows with totals", () => {
    const result = generateFinancialExport(demoData, {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.csv).toContain("statement_month");
    expect(result.csv).toContain("processor_cost");
    expect(result.csv).toContain("TOTAL");
    expect(result.totals.netResidual).toBeGreaterThan(0);
    expect(result.totals.processorCost).toBeGreaterThanOrEqual(0);
    expect(result.totals.processingVolume).toBeGreaterThan(0);
  });

  it("filters exports by processor", () => {
    const result = generateFinancialExport(demoData, { processor: "Fiserv" });

    expect(result.rows.every((row) => row.processor === "Fiserv")).toBe(true);
  });
});
