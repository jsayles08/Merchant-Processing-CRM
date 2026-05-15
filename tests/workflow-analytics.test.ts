import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import { buildWorkflowAnalytics, calculateConversionRate } from "@/lib/workflow-analytics";

describe("workflow analytics", () => {
  it("calculates conversion rates safely", () => {
    expect(calculateConversionRate(0, 0)).toBe(0);
    expect(calculateConversionRate(8, 2)).toBe(25);
  });

  it("summarizes recruiting and onboarding workflow data", () => {
    const analytics = buildWorkflowAnalytics(demoData);

    expect(analytics.metrics.totalRecruits).toBe(2);
    expect(analytics.metrics.activeRecruitPipeline).toBe(2);
    expect(analytics.metrics.agentOnboardingCompletion).toBe(50);
    expect(analytics.recruitStatus.find((item) => item.name === "Interested")?.value).toBe(1);
    expect(analytics.merchantOnboardingStatus.find((item) => item.name === "Under Review")?.value).toBe(1);
  });

  it("scopes analytics for agents while admins see the company", () => {
    const admin = demoData.profiles.find((profile) => profile.role === "admin");
    const agent = demoData.profiles.find((profile) => profile.id === "profile-agent-3");

    const adminAnalytics = buildWorkflowAnalytics(demoData, admin);
    const agentAnalytics = buildWorkflowAnalytics(demoData, agent);

    expect(adminAnalytics.metrics.totalAgents).toBe(3);
    expect(agentAnalytics.metrics.totalAgents).toBe(1);
    expect(agentAnalytics.scopedData.merchants.every((merchant) => merchant.assigned_agent_id === "agent-3")).toBe(true);
  });
});
