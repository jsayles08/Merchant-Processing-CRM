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

  it("uses priority order when multiple underwriting rules match", () => {
    const result = evaluateUnderwritingDecision({
      record: demoData.merchantOnboardingRecords[0],
      steps: demoData.merchantOnboardingSteps.map((step) => ({ ...step, completed_at: "2026-01-01T00:00:00.000Z" })),
      proposedRate: 1.72,
      rules: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Manual review high-touch accounts",
          outcome: "manual_review",
          enabled: true,
          priority: 10,
          conditions: { minMonthlyVolume: 1 },
          created_by: null,
          updated_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          name: "Approve complete packet",
          outcome: "approve",
          enabled: true,
          priority: 100,
          conditions: { minMonthlyVolume: 1, minDocumentCompletionRate: 1 },
          created_by: null,
          updated_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(result.decision).toBe("manual_review");
    expect(result.reasons[0]).toContain("Manual review high-touch accounts");
  });

  it("supports maximum proposed rate conditions", () => {
    const result = evaluateUnderwritingDecision({
      record: demoData.merchantOnboardingRecords[0],
      steps: demoData.merchantOnboardingSteps,
      proposedRate: 1.4,
      rules: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Decline below floor",
          outcome: "deny",
          enabled: true,
          priority: 10,
          conditions: { maxProposedRate: 1.49 },
          created_by: null,
          updated_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(result.decision).toBe("declined");
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

    expect(
      validateUnderwritingRule({
        name: "Impossible range",
        outcome: "manual_review",
        priority: 100,
        conditions: { minMonthlyVolume: 50000, maxMonthlyVolume: 10000 },
      }),
    ).toContain("Minimum monthly volume");
  });
});
