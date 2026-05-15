import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase } = await getSessionContext();
  const [presence, connections, logs] = await Promise.all([
    supabase.from("agent_presence").select("*").order("last_seen_at", { ascending: false }),
    supabase
      .from("processor_connections")
      .select("id,provider,display_name,account_identifier,agent_profile_id,auth_type,status,last_sync_at,last_tested_at,last_error,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("agent_activity_logs").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  const error = presence.error ?? connections.error ?? logs.error;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    presence: presence.data ?? [],
    connections: connections.data ?? [],
    logs: logs.data ?? [],
  });
}
