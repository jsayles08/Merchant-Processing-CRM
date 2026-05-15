import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { writeAgentActivity } from "@/lib/activity";
import {
  getConnectionPublicMetadata,
  getProcessorProvider,
  testProcessorCredentials,
  unsealProcessorCredentials,
} from "@/lib/processor-integrations";
import type { ProcessorConnection } from "@/lib/types";

export const dynamic = "force-dynamic";

type ConnectionWithSecret = ProcessorConnection & { encrypted_credentials: string | null };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await getSessionContext();

  const { data: connection, error } = await supabase
    .from("processor_connections")
    .select("*")
    .eq("id", id)
    .maybeSingle<ConnectionWithSecret>();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!connection) {
    return NextResponse.json({ ok: false, error: "Processor connection was not found." }, { status: 404 });
  }

  const provider = getProcessorProvider(connection.provider);
  let credentials: ReturnType<typeof unsealProcessorCredentials>;
  try {
    credentials = unsealProcessorCredentials(connection.encrypted_credentials);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stored credentials could not be decrypted.";
    await writeAgentActivity(supabase, {
      profileId: connection.agent_profile_id,
      actorProfileId: profile.id,
      eventType: "integration.test.failed",
      eventSource: "processor",
      provider: provider.id,
      connectionId: connection.id,
      severity: "security",
      summary: `${provider.name} connection test failed because stored credentials could not be decrypted.`,
      metadata: { error: message },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
  const result = await testProcessorCredentials({
    provider: provider.id,
    authType: connection.auth_type,
    accountIdentifier: connection.account_identifier,
    credentials,
    environment: String(connection.metadata?.environment ?? "sandbox"),
  });

  const { data: updated, error: updateError } = await supabase
    .from("processor_connections")
    .update({
      status: result.status,
      last_tested_at: new Date().toISOString(),
      last_error: result.ok ? null : result.message,
      updated_by: profile.id,
    })
    .eq("id", connection.id)
    .select(
      "id,provider,display_name,account_identifier,agent_profile_id,created_by,updated_by,auth_type,status,metadata,last_sync_at,last_tested_at,last_error,disconnected_at,created_at,updated_at",
    )
    .single<ProcessorConnection>();

  if (updateError || !updated) {
    return NextResponse.json({ ok: false, error: updateError?.message ?? "Connection test status was not saved." }, { status: 500 });
  }

  await writeAgentActivity(supabase, {
    profileId: connection.agent_profile_id,
    actorProfileId: profile.id,
    eventType: result.ok ? "integration.test.success" : "integration.test.failed",
    eventSource: "processor",
    provider: provider.id,
    connectionId: connection.id,
    severity: result.ok ? "info" : "error",
    summary: `${provider.name} connection test ${result.ok ? "passed" : "failed"} for ${connection.account_identifier}.`,
    metadata: { message: result.message, auth_type: connection.auth_type },
  });

  return NextResponse.json({ ok: result.ok, connection: getConnectionPublicMetadata(updated), message: result.message }, { status: result.ok ? 200 : 422 });
}
