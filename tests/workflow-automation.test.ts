import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import { evaluateOpportunityStageAutomation } from "@/lib/workflow-automation";

describe("opportunity workflow automation", () => {
  it("moves a lead to contacted when a real outreach update is logged", () => {
    const merchant = { ...demoData.merchants[0], status: "lead" as const };

    const transition = evaluateOpportunityStageAutomation(merchant, {
      type: "merchant_update_logged",
      updateType: "call",
      updateId: "update-1",
      source: "merchant_update",
    });

    expect(transition?.newStage).toBe("contacted");
    expect(transition?.reason).toContain("Call update");
  });

  it("does not move a lead from weak note-only activity", () => {
    const merchant = { ...demoData.merchants[0], status: "lead" as const };

    const transition = evaluateOpportunityStageAutomation(merchant, {
      type: "merchant_update_logged",
      updateType: "note",
      updateId: "update-1",
      source: "merchant_update",
    });

    expect(transition).toBeNull();
  });

  it("moves contacted merchants to qualified only when qualification data exists", () => {
    const qualifiedMerchant = { ...demoData.merchants[0], status: "contacted" as const };
    const incompleteMerchant = {
      ...qualifiedMerchant,
      monthly_volume_estimate: 0,
      average_ticket: 0,
      current_processor: "",
    };

    expect(
      evaluateOpportunityStageAutomation(qualifiedMerchant, {
        type: "merchant_update_logged",
        updateType: "call",
        updateId: "update-1",
        source: "merchant_update",
      })?.newStage,
    ).toBe("qualified");
    expect(
      evaluateOpportunityStageAutomation(incompleteMerchant, {
        type: "merchant_update_logged",
        updateType: "call",
        updateId: "update-1",
        source: "merchant_update",
      }),
    ).toBeNull();
  });

  it("maps signature and underwriting events into pipeline milestones", () => {
    const merchant = { ...demoData.merchants[0], status: "qualified" as const };

    expect(
      evaluateOpportunityStageAutomation(merchant, {
        type: "signature_request_sent",
        signatureRequestId: "signature-1",
        signatureStatus: "sent",
        relatedEntityType: "merchant",
        source: "signature_request",
      })?.newStage,
    ).toBe("application_sent");
    expect(
      evaluateOpportunityStageAutomation({ ...merchant, status: "underwriting" }, {
        type: "underwriting_decision_recorded",
        onboardingId: "onboarding-1",
        decisionId: "decision-1",
        decision: "approved",
        source: "underwriting",
      })?.newStage,
    ).toBe("approved");
  });

  it("keeps merchant onboarding status changes aligned with opportunity stages", () => {
    const merchant = { ...demoData.merchants[0], status: "lead" as const };

    expect(
      evaluateOpportunityStageAutomation(merchant, {
        type: "merchant_onboarding_status_changed",
        onboardingId: "onboarding-1",
        onboardingStatus: "contacted",
        source: "merchant_onboarding",
      })?.newStage,
    ).toBe("contacted");
  });
});
