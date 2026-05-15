import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { writeAgentActivity } from "@/lib/activity";
import { getSessionContext } from "@/lib/auth";
import { buildOAuthAuthorizationUrl, getProcessorProvider } from "@/lib/processor-integrations";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const { supabase, profile } = await getSessionContext();
  const provider = getProcessorProvider(providerId);
  const state = randomBytes(32).toString("base64url");
  const authorizationUrl = buildOAuthAuthorizationUrl(provider.id, state);

  if (!authorizationUrl) {
    await writeAgentActivity(supabase, {
      profileId: profile.id,
      actorProfileId: profile.id,
      eventType: "integration.oauth.not_configured",
      eventSource: "processor",
      provider: provider.id,
      severity: "warning",
      summary: `${provider.name} OAuth was requested but is not configured.`,
      metadata: { required_env: [`${provider.id.toUpperCase()}_OAUTH_CLIENT_ID`, `${provider.id.toUpperCase()}_OAUTH_REDIRECT_URI`] },
    });
    return NextResponse.json(
      { ok: false, error: `${provider.name} OAuth is not configured yet. Use encrypted API credentials or add provider OAuth env vars.` },
      { status: 503 },
    );
  }

  await writeAgentActivity(supabase, {
    profileId: profile.id,
    actorProfileId: profile.id,
    eventType: "integration.oauth.start",
    eventSource: "processor",
    provider: provider.id,
    summary: `${profile.full_name} started ${provider.name} OAuth connection.`,
    metadata: { state_hint: state.slice(0, 8) },
  });

  return NextResponse.redirect(authorizationUrl);
}
