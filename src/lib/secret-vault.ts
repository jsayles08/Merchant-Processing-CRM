import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const keyLength = 32;
const ivLength = 12;

export function isIntegrationEncryptionConfigured() {
  return Boolean(process.env.INTEGRATION_ENCRYPTION_KEY);
}

export function encryptSecretPayload(payload: Record<string, unknown>) {
  const cipherKey = getEncryptionKey();
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, cipherKey, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecretPayload<T extends Record<string, unknown> = Record<string, unknown>>(sealed: string): T {
  const [version, ivPart, tagPart, encryptedPart] = sealed.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !encryptedPart) {
    throw new Error("Unsupported integration secret payload.");
  }

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function redactSecretValue(value: unknown) {
  if (value === null || value === undefined) return value;
  const stringValue = String(value);
  if (!stringValue) return "";
  if (stringValue.length <= 4) return "****";
  return `${"*".repeat(Math.min(stringValue.length - 4, 8))}${stringValue.slice(-4)}`;
}

function getEncryptionKey() {
  const configured = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured for processor credential storage.");
  }

  const trimmed = configured.trim();

  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === keyLength) return decoded;
  } catch {
    // Fall through to hash derivation below.
  }

  return createHash("sha256").update(trimmed).digest();
}
