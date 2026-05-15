import { NextResponse } from "next/server";
import { writeAgentActivity } from "@/lib/activity";
import { writeAuditLog } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { getConnectionPublicMetadata, getProcessorProvider } from "@/lib/processor-integrations";
import type { ProcessorConnection } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await getSessionContext();

  const { data: connection, error } = await supabase
    .from("processor_connections")
    .select(
      "id,provider,display_name,account_identifier,agent_profile_id,created_by,updated_by,auth_type,status,metadata,last_sync_at,last_tested_at,last_error,disconnected_at,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle<ProcessorConnection>();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!connection) {
    return NextResponse.json({ ok: false, error: "Processor connection was not found." }, { status: 404 });
  }

  const provider = getProcessorProvider(connection.provider);
  const { data: updated, error: updateError } = await supabase
    .from("processor_connections")
    .update({
      status: "disconnected",
      disconnected_at: new Date().toISOString(),
      last_error: null,
      updated_by: profile.id,
    })
    .eq("id", connection.id)
    .select(
      "id,provider,display_name,account_identifier,agent_profile_id,created_by,updated_by,auth_type,status,metadata,last_sync_at,last_tested_at,last_error,disconnected_at,created_at,updated_at",
    )
    .single<ProcessorConnection>();

  if (updateError || !updated) {
    return NextResponse.json({ ok: false, error: updateError?.message ?? "Connection was not disconnected." }, { status: 500 });
  }

  await writeAgentActivity(supabase, {
    profileId: connection.agent_profile_id,
    actorProfileId: profile.id,
    eventType: "integration.disconnect.success",
    eventSource: "processor",
    provider: provider.id,
    connectionId: connection.id,
    severity: "warning",
    summary: `${profile.full_name} disconnected ${provider.name} account ${connection.account_identifier}.`,
    metadata: { previous_status: connection.status },
  });

  await writeAuditLog(supabase, profile, {
    action: "integration.processor.disconnect",
    entityType: "processor_connection",
    entityId: connection.id,
    summary: `${profile.full_name} disconnected ${provider.name} for ${connection.account_identifier}.`,
    metadata: { provider: provider.id, agent_profile_id: connection.agent_profile_id },
  });

  return NextResponse.json({ ok: true, connection: getConnectionPublicMetadata(updated) });
}
