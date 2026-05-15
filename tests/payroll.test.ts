import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import { generatePayrollExport, testPayrollIntegration } from "@/lib/payroll";

describe("payroll exports and integrations", () => {
  it("generates payroll CSV with commission and adjustment totals", () => {
    const result = generatePayrollExport(demoData, {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.csv).toContain("agent_name");
    expect(result.csv).toContain("TOTAL");
    expect(result.totals.grossCommissions).toBeGreaterThan(0);
    expect(result.totals.totalPayout).toBeGreaterThan(0);
  });

  it("guards payroll provider credentials through adapters", async () => {
    await expect(
      testPayrollIntegration({ provider: "stripe", credentials: {}, accountIdentifier: "acct_123" }),
    ).resolves.toMatchObject({ ok: false, status: "error" });

    await expect(
      testPayrollIntegration({ provider: "stripe", credentials: { apiKey: "sk_test_123" }, accountIdentifier: "acct_123" }),
    ).resolves.toMatchObject({ ok: true, status: "connected" });
  });
});
