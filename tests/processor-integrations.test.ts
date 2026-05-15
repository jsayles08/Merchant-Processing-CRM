import { describe, expect, it, beforeEach } from "vitest";
import { sanitizeActivityMetadata } from "@/lib/activity";
import {
  getProcessorProvider,
  redactCredentialsForLog,
  sealProcessorCredentials,
  testProcessorCredentials,
  unsealProcessorCredentials,
} from "@/lib/processor-integrations";

describe("processor integration security and adapters", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "test-encryption-key-that-is-long-enough-for-hashing";
  });

  it("encrypts and decrypts provider credentials without returning plaintext envelopes", () => {
    const sealed = sealProcessorCredentials({ apiKey: "sk_live_123456", apiSecret: "secret-value" });

    expect(sealed).not.toContain("sk_live_123456");
    expect(sealed).not.toContain("secret-value");
    expect(unsealProcessorCredentials(sealed)).toEqual({ apiKey: "sk_live_123456", apiSecret: "secret-value" });
  });

  it("redacts sensitive values before logging", () => {
    expect(redactCredentialsForLog({ apiKey: "abcd12345678", apiSecret: "super-secret" })).toEqual({
      apiKey: "********5678",
      apiSecret: "********cret",
    });
    expect(sanitizeActivityMetadata({ nested: { token: "secret-token", safe: "value" } })).toEqual({
      nested: { token: "[redacted]", safe: "value" },
    });
  });

  it("validates provider auth capabilities and required credential shape", async () => {
    const nuvei = getProcessorProvider("nuvei");

    expect(nuvei.supportedAuthTypes).toContain("api_key");
    await expect(
      testProcessorCredentials({
        provider: "nuvei",
        authType: "api_key",
        accountIdentifier: "merchant-123",
        credentials: { apiKey: "nuvei-key" },
      }),
    ).resolves.toMatchObject({ ok: true, status: "connected" });

    await expect(
      testProcessorCredentials({
        provider: "nuvei",
        authType: "oauth",
        accountIdentifier: "merchant-123",
        credentials: { oauthCode: "code" },
      }),
    ).resolves.toMatchObject({ ok: false, status: "error" });
  });
});
