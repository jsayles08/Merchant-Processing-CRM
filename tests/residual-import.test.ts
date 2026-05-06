import { describe, expect, it } from "vitest";
import { normalizeImportMonth, parseProcessorResidualCsv } from "@/lib/residual-import";

describe("residual import parsing", () => {
  it("parses processor CSV rows with currency formatting", () => {
    const result = parseProcessorResidualCsv(
      [
        "business_name,processing_volume,net_residual",
        '"Main Street Dental","$125,000.50","$1,875.25"',
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        lineNumber: 2,
        business_name: "Main Street Dental",
        processing_volume: 125000.5,
        net_residual: 1875.25,
      },
    ]);
  });

  it("reports missing merchant and residual fields without importing bad rows", () => {
    const result = parseProcessorResidualCsv(
      [
        "business_name,processing_volume,net_residual",
        ",1000,20",
        "Acme,1000,",
      ].join("\n"),
    );

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toEqual([
      "Line 2: include merchant_id or business_name.",
      "Line 3: net_residual is required.",
    ]);
  });

  it("normalizes any date in a processor statement to the first of the month", () => {
    expect(normalizeImportMonth("2026-05-23")).toBe("2026-05-01");
  });
});

