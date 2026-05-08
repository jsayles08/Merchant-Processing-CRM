import { describe, expect, it } from "vitest";
import { getPresentedIntegrationKey, isValidIntegrationKey } from "@/lib/api-auth";

describe("integration API auth", () => {
  it("accepts bearer tokens from the Authorization header", () => {
    const headers = new Headers({ authorization: "Bearer secret-token" });

    expect(getPresentedIntegrationKey(headers)).toBe("secret-token");
  });

  it("accepts the MerchantDesk API key header as a fallback", () => {
    const headers = new Headers({ "x-merchantdesk-api-key": "fallback-token" });

    expect(getPresentedIntegrationKey(headers)).toBe("fallback-token");
  });

  it("compares integration keys without exposing raw secret values", () => {
    expect(isValidIntegrationKey("live-secret", "live-secret")).toBe(true);
    expect(isValidIntegrationKey("wrong-secret", "live-secret")).toBe(false);
    expect(isValidIntegrationKey(null, "live-secret")).toBe(false);
  });
});
