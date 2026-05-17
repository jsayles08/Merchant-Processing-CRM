import { describe, expect, it } from "vitest";
import { buildAgentDirectory, buildSuggestedAgentCode } from "@/lib/agent-management";
import { demoData } from "@/lib/demo-data";

describe("agent management", () => {
  it("builds an agent directory with ownership and manager context", () => {
    const rows = buildAgentDirectory(demoData);
    const jordan = rows.find((row) => row.profile.full_name === "Jordan Ellis");

    expect(rows).toHaveLength(3);
    expect(jordan?.manager?.full_name).toBe("Andre Blake");
    expect(jordan?.merchantCount).toBeGreaterThan(0);
    expect(jordan?.canHardDelete).toBe(false);
  });

  it("suggests stable agent codes and avoids collisions", () => {
    expect(buildSuggestedAgentCode("Jane Marie Doe", [], "1234")).toBe("MD-JMD-1234");
    expect(buildSuggestedAgentCode("Jane Marie Doe", ["MD-JMD-1234"], "1234")).toBe("MD-JMD-1234-2");
  });
});
