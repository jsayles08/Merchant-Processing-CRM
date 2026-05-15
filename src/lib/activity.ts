import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivitySeverity, Profile } from "@/lib/types";

export type AgentActivityInput = {
  profileId?: string | null;
  actorProfileId?: string | null;
  eventType: string;
  eventSource?: string;
  provider?: string | null;
  connectionId?: string | null;
  severity?: ActivitySeverity;
  summary: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const sensitiveKeyPattern = /(password|secret|token|api[_-]?key|authorization|credential|access[_-]?token|refresh[_-]?token)/i;

export async function writeAgentActivity(supabase: SupabaseClient, input: AgentActivityInput) {
  const { error } = await supabase.from("agent_activity_logs").insert({
    profile_id: input.profileId ?? input.actorProfileId ?? null,
    actor_profile_id: input.actorProfileId ?? null,
    event_type: input.eventType,
    event_source: input.eventSource ?? "app",
    provider: input.provider ?? null,
    connection_id: input.connectionId ?? null,
    severity: input.severity ?? "info",
    summary: input.summary,
    metadata: sanitizeActivityMetadata(input.metadata ?? {}),
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });

  if (error) {
    console.error("Unable to write agent activity", error);
  }
}

export async function writeProfileActivity(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "full_name">,
  eventType: string,
  summary: string,
  metadata?: Record<string, unknown>,
) {
  await writeAgentActivity(supabase, {
    profileId: profile.id,
    actorProfileId: profile.id,
    eventType,
    summary,
    metadata,
  });
}

export function sanitizeActivityMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeActivityMetadata(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[redacted]" : sanitizeActivityMetadata(entryValue),
    ]),
  );
}
