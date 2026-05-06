import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

export type AuditEventInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(
  supabase: SupabaseClient,
  actor: Pick<Profile, "id"> | null,
  event: AuditEventInput,
) {
  const { error } = await supabase.from("audit_logs").insert({
    actor_profile_id: actor?.id ?? null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    summary: event.summary,
    metadata: event.metadata ?? {},
  });

  if (error) {
    console.error("Unable to write audit log", error);
  }
}

