import { describe, expect, it } from "vitest";
import { defaultRolePermissions, hasPermission } from "@/lib/permissions";

describe("enterprise permission defaults", () => {
  it("restricts finance, payroll, and underwriting controls to admins by default", () => {
    const permissions = defaultRolePermissions();

    expect(hasPermission("agent", permissions, "finance.export")).toBe(false);
    expect(hasPermission("manager", permissions, "payroll.export")).toBe(false);
    expect(hasPermission("manager", permissions, "processor_pricing.manage")).toBe(false);
    expect(hasPermission("manager", permissions, "underwriting.manage")).toBe(false);
    expect(hasPermission("admin", permissions, "finance.export")).toBe(true);
    expect(hasPermission("admin", permissions, "payroll.integrations")).toBe(true);
    expect(hasPermission("admin", permissions, "processor_pricing.manage")).toBe(true);
    expect(hasPermission("admin", permissions, "underwriting.manage")).toBe(true);
  });

  it("adds agent-directory access without giving every agent management powers", () => {
    const permissions = defaultRolePermissions();

    expect(hasPermission("agent", permissions, "agents.view")).toBe(false);
    expect(hasPermission("agent", permissions, "agents.manage")).toBe(false);
    expect(hasPermission("manager", permissions, "agents.view")).toBe(true);
    expect(hasPermission("manager", permissions, "agents.manage")).toBe(false);
    expect(hasPermission("admin", permissions, "agents.view")).toBe(true);
    expect(hasPermission("admin", permissions, "agents.manage")).toBe(true);
  });
});
