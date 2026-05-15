import { NextResponse } from "next/server";
import { writeAgentActivity } from "@/lib/activity";
import { writeAuditLog } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { getConnectionPublicMetadata, getProcessorProvider, syncProcessorConnection } from "@/lib/processor-integrations";
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
  const startedAt = new Date().toISOString();

  const { data: syncRun, error: syncRunError } = await supabase
    .from("processor_sync_runs")
    .insert({
      connection_id: connection.id,
      status: "running",
      started_at: startedAt,
      metadata: { requested_by: profile.id, provider: provider.id },
    })
    .select("id")
    .single<{ id: string }>();

  if (syncRunError || !syncRun) {
    return NextResponse.json({ ok: false, error: syncRunError?.message ?? "Unable to start sync run." }, { status: 500 });
  }

  await supabase.from("processor_connections").update({ status: "syncing", updated_by: profile.id }).eq("id", connection.id);

  const result = await syncProcessorConnection(connection);
  const finishedAt = new Date().toISOString();

  await supabase
    .from("processor_sync_runs")
    .update({
      status: result.ok ? "success" : "error",
      finished_at: finishedAt,
      records_processed: result.recordsProcessed ?? 0,
      error_message: result.ok ? null : result.message,
      metadata: result.metadata ?? {},
    })
    .eq("id", syncRun.id);

  const { data: updated, error: updateError } = await supabase
    .from("processor_connections")
    .update({
      status: result.status,
      last_sync_at: result.ok ? finishedAt : connection.last_sync_at,
      last_error: result.ok ? null : result.message,
      updated_by: profile.id,
    })
    .eq("id", connection.id)
    .select(
      "id,provider,display_name,account_identifier,agent_profile_id,created_by,updated_by,auth_type,status,metadata,last_sync_at,last_tested_at,last_error,disconnected_at,created_at,updated_at",
    )
    .single<ProcessorConnection>();

  if (updateError || !updated) {
    return NextResponse.json({ ok: false, error: updateError?.message ?? "Sync status was not saved." }, { status: 500 });
  }

  await writeAgentActivity(supabase, {
    profileId: connection.agent_profile_id,
    actorProfileId: profile.id,
    eventType: result.ok ? "integration.sync.success" : "integration.sync.failed",
    eventSource: "processor",
    provider: provider.id,
    connectionId: connection.id,
    severity: result.ok ? "info" : "error",
    summary: `${provider.name} sync ${result.ok ? "completed" : "failed"} for ${connection.account_identifier}.`,
    metadata: {
      records_processed: result.recordsProcessed ?? 0,
      message: result.message,
      sync_run_id: syncRun.id,
    },
  });

  await writeAuditLog(supabase, profile, {
    action: result.ok ? "integration.processor.sync" : "integration.processor.sync_failed",
    entityType: "processor_connection",
    entityId: connection.id,
    summary: `${provider.name} sync ${result.ok ? "completed" : "failed"} for ${connection.account_identifier}.`,
    metadata: { provider: provider.id, sync_run_id: syncRun.id, records_processed: result.recordsProcessed ?? 0 },
  });

  return NextResponse.json({
    ok: result.ok,
    connection: getConnectionPublicMetadata(updated),
    message: result.message,
    recordsProcessed: result.recordsProcessed ?? 0,
  });
}
