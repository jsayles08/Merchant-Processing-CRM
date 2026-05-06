import { describe, expect, it } from "vitest";
import {
  calculateMonthlyAgentIncome,
  calculateTeamOverridePercentage,
  requiresManagementApproval,
} from "@/lib/compensation";
import type { CompensationRule, TeamMember } from "@/lib/types";

const rule: CompensationRule = {
  id: "rule",
  rule_name: "MerchantDesk Standard Agent Plan",
  base_residual_percentage: 40,
  minimum_processing_rate: 1.5,
  override_per_active_recruit: 0.25,
  max_override_per_team: 1,
  active_recruit_required_merchants: 2,
  active_recruit_required_processing_days: 90,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("compensation", () => {
  it("flags pricing below the management approval floor", () => {
    expect(requiresManagementApproval(1.49, rule.minimum_processing_rate)).toBe(true);
    expect(requiresManagementApproval(1.5, rule.minimum_processing_rate)).toBe(false);
  });

  it("caps team override percentage at the rule maximum", () => {
    const members = Array.from({ length: 8 }, (_, index) => ({
      id: `member-${index}`,
      team_id: "team",
      agent_id: `agent-${index}`,
      sponsor_agent_id: "leader",
      active_recruit_status: true,
      active_status_date: "2026-01-01",
      created_at: "2026-01-01T00:00:00.000Z",
    })) satisfies TeamMember[];

    expect(calculateTeamOverridePercentage(members, rule)).toBe(1);
  });

  it("combines personal residual and team override earnings", () => {
    const income = calculateMonthlyAgentIncome({
      agentId: "agent-1",
      compensationRule: rule,
      teamMembers: [
        {
          id: "member-1",
          team_id: "team",
          agent_id: "agent-2",
          sponsor_agent_id: "agent-1",
          active_recruit_status: true,
          active_status_date: "2026-01-01",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      residuals: [
        {
          id: "residual-1",
          merchant_id: "merchant-1",
          agent_id: "agent-1",
          month: "2026-05-01",
          processing_volume: 100000,
          net_residual: 1000,
          agent_residual_amount: 400,
          company_share: 600,
          created_at: "2026-05-01T00:00:00.000Z",
        },
        {
          id: "residual-2",
          merchant_id: "merchant-2",
          agent_id: "agent-2",
          month: "2026-05-01",
          processing_volume: 200000,
          net_residual: 2000,
          agent_residual_amount: 800,
          company_share: 1200,
          created_at: "2026-05-01T00:00:00.000Z",
        },
      ],
    });

    expect(income.personalResidualIncome).toBe(400);
    expect(income.overridePercentage).toBe(0.25);
    expect(income.teamOverrideEarnings).toBe(5);
    expect(income.totalMonthlyIncome).toBe(405);
  });
});

