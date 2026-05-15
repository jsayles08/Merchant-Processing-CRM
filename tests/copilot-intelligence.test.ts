import { describe, expect, it } from "vitest";
import { buildStructuredFallback } from "@/lib/copilot-intelligence";
import { demoData } from "@/lib/demo-data";

describe("copilot deterministic planner", () => {
  it("does not turn greetings into fake CRM actions", () => {
    const response = buildStructuredFallback({ message: "hello", data: demoData });

    expect(response.actions).toEqual([]);
    expect(response.content).toContain("ready to help");
    expect(response.suggestions.length).toBeGreaterThan(0);
  });

  it("matches messy call notes to known merchants and drafts concrete actions", () => {
    const response = buildStructuredFallback({
      message: "I spoke to Mike at Joe's Pizza. Follow up Friday. They now process about $50k/month.",
      data: demoData,
    });

    const actionTypes = response.actions.map((action) => action.action_type);
    expect(response.content).toContain("Joe's Pizza Works");
    expect(actionTypes).toContain("create_task");
    expect(actionTypes).toContain("add_merchant_update");
    expect(actionTypes).toContain("update_merchant_profile");
    expect(response.actions.every((action) => action.payload?.merchant_id === "merchant-1")).toBe(true);
  });

  it("refuses to retain obvious secrets as learned memory", () => {
    const response = buildStructuredFallback({
      message: "Remember: the shared password is a private credential",
      data: demoData,
    });

    expect(response.memories).toEqual([]);
  });

  it("builds follow-up recommendations from open CRM work", () => {
    const response = buildStructuredFallback({
      message: "Which merchants should I follow up with today?",
      data: demoData,
    });

    expect(response.actions[0]?.action_type).toBe("next_best_action");
    expect(response.content).toContain("best follow-ups");
  });
});
