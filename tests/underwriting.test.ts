import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import {
  evaluateUnderwritingDecision,
  validateUnderwritingRule,
} from "@/lib/underwriting";

describe("underwriting rules", () => {
  it("routes incomplete document packets to manual review", () => {
    const result = evaluateUnderwritingDecision({
      record: demoData.merchantOnboardingRecords[0],
      steps: demoData.merchantOnboardingSteps,
      proposedRate: 1.72,
      rules: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Manual review incomplete packets",
          outcome: "manual_review",
          enabled: true,
          priority: 50,
          conditions: { maxDocumentCompletionRate: 0.79 },
          created_by: null,
          updated_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(result.decision).toBe("manual_review");
    expect(result.documentCompletionRate).toBeCloseTo(0.67, 2);
  });

  it("validates obviously broken underwriting settings", () => {
    expect(
      validateUnderwritingRule({
        name: "",
        outcome: "approve",
        priority: 100,
        conditions: { minMonthlyVolume: 10000 },
      }),
    ).toContain("Rule name");

    expect(
      validateUnderwritingRule({
        name: "Complete packet",
        outcome: "approve",
        priority: 100,
        conditions: { minDocumentCompletionRate: 1.5 },
      }),
    ).toContain("between 0 and 1");
  });
});
