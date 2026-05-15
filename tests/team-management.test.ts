import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import { canAssignRecruitToTeam, getTeamCapacity, progressForRecruitStatus } from "@/lib/team-management";

describe("team management", () => {
  it("enforces the team recruit capacity limit", () => {
    const team = demoData.teams[0];
    const recruit = demoData.agentRecruits[1];

    expect(getTeamCapacity(demoData, team, 4).used).toBe(3);
    expect(canAssignRecruitToTeam(demoData, team, recruit, 4).ok).toBe(true);
    expect(canAssignRecruitToTeam(demoData, team, recruit, 3).ok).toBe(false);
  });

  it("maps recruit statuses to stable progress percentages", () => {
    expect(progressForRecruitStatus("new_lead")).toBe(10);
    expect(progressForRecruitStatus("onboarding")).toBe(82);
    expect(progressForRecruitStatus("active")).toBe(100);
  });
});
