import { NextResponse } from "next/server";
import { writeAgentActivity } from "@/lib/activity";
import { getSessionContext } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { getProcessorProvider } from "@/lib/processor-integrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const { supabase, profile } = await getSessionContext();
  const provider = getProcessorProvider(providerId);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const settingsUrl = new URL("/settings", getAppUrl());

  if (error || !code) {
    await writeAgentActivity(supabase, {
      profileId: profile.id,
      actorProfileId: profile.id,
      eventType: "integration.oauth.callback_failed",
      eventSource: "processor",
      provider: provider.id,
      severity: "error",
      summary: `${provider.name} OAuth callback did not return a usable authorization code.`,
      metadata: { error: error ?? "missing_code" },
    });
    settingsUrl.searchParams.set("integration_error", `${provider.name} OAuth did not complete.`);
    return NextResponse.redirect(settingsUrl);
  }

  await writeAgentActivity(supabase, {
    profileId: profile.id,
    actorProfileId: profile.id,
    eventType: "integration.oauth.callback_received",
    eventSource: "processor",
    provider: provider.id,
    summary: `${provider.name} OAuth callback received an authorization code for token exchange.`,
    metadata: { code: "[redacted]", state_present: Boolean(url.searchParams.get("state")) },
  });

  settingsUrl.searchParams.set("integration_message", `${provider.name} OAuth returned a code. Provider token exchange is ready to wire once client secret details are active.`);
  return NextResponse.redirect(settingsUrl);
}
