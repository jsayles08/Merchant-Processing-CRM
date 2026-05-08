import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export function getPresentedIntegrationKey(headers: Headers) {
  const authorization = headers.get("authorization") ?? "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch?.[1]?.trim();

  return bearerToken || headers.get("x-merchantdesk-api-key")?.trim() || null;
}

export function isValidIntegrationKey(candidate: string | null, expected = process.env.MERCHANTDESK_API_KEY) {
  if (!candidate || !expected) return false;

  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();

  return timingSafeEqual(candidateHash, expectedHash);
}

export function getIntegrationAuthError(request: Request) {
  if (!process.env.MERCHANTDESK_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "MERCHANTDESK_API_KEY is not configured for integration routes." },
      { status: 503 },
    );
  }

  if (!isValidIntegrationKey(getPresentedIntegrationKey(request.headers))) {
    return NextResponse.json({ ok: false, error: "Unauthorized integration request." }, { status: 401 });
  }

  return null;
}
