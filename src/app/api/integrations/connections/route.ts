import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { writeAgentActivity } from "@/lib/activity";
import { writeAuditLog } from "@/lib/audit";
import {
  getConnectionPublicMetadata,
  getProcessorProvider,
  ProcessorConnectSchema,
  redactCredentialsForLog,
  sealProcessorCredentials,
  testProcessorCredentials,
} from "@/lib/processor-integrations";
import { isIntegrationEncryptionConfigured } from "@/lib/secret-vault";
import type { ProcessorConnection } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase } = await getSessionContext();
  const { data, error } = await supabase
    .from("processor_connections")
    .select(
      "id,provider,display_name,account_identifier,agent_profile_id,created_by,updated_by,auth_type,status,metadata,last_sync_at,last_tested_at,last_error,disconnected_at,created_at,updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, connections: (data ?? []).map((row) => getConnectionPublicMetadata(row as ProcessorConnection)) });
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = ProcessorConnectSchema.safeParse(body.body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  if (!isIntegrationEncryptionConfigured()) {
    return NextResponse.json(
      { ok: false, error: "INTEGRATION_ENCRYPTION_KEY is required before processor credentials can be stored." },
      { status: 503 },
    );
  }

  const { supabase, profile } = await getSessionContext();
  const input = parsed.data;
  const agentProfileId = profile.role === "admin" && input.agent_profile_id ? input.agent_profile_id : profile.id;
  const provider = getProcessorProvider(input.provider);

  const testResult = await testProcessorCredentials({
    provider: input.provider,
    authType: input.auth_type,
    accountIdentifier: input.account_identifier,
    credentials: input.credentials,
    environment: input.environment,
  });

  const sealedCredentials = sealProcessorCredentials(input.credentials);
  const now = new Date().toISOString();
  const metadata = {
    environment: input.environment,
    adapter_mode: testResult.metadata?.adapter_mode ?? "credential_validation",
    credential_fields: Object.keys(redactCredentialsForLog(input.credentials)),
  };

  const { data: connection, error } = await supabase
    .from("processor_connections")
    .insert({
      provider: input.provider,
      display_name: input.display_name,
      account_identifier: input.account_identifier,
      agent_profile_id: agentProfileId,
      created_by: profile.id,
      updated_by: profile.id,
      auth_type: input.auth_type,
      status: testResult.ok ? "connected" : "error",
      encrypted_credentials: sealedCredentials,
      metadata,
      last_tested_at: now,
      last_error: testResult.ok ? null : testResult.message,
    })
    .select(
      "id,provider,display_name,account_identifier,agent_profile_id,created_by,updated_by,auth_type,status,metadata,last_sync_at,last_tested_at,last_error,disconnected_at,created_at,updated_at",
    )
    .single<ProcessorConnection>();

  if (error || !connection) {
    await writeAgentActivity(supabase, {
      profileId: agentProfileId,
      actorProfileId: profile.id,
      eventType: "integration.connect.failed",
      eventSource: "processor",
      provider: input.provider,
      severity: "error",
      summary: `${profile.full_name} could not connect ${provider.name}.`,
      metadata: { error: error?.message ?? "Connection was not created.", credentials: redactCredentialsForLog(input.credentials) },
    });
    return NextResponse.json({ ok: false, error: error?.message ?? "Processor connection was not created." }, { status: 500 });
  }

  await writeAgentActivity(supabase, {
    profileId: agentProfileId,
    actorProfileId: profile.id,
    eventType: testResult.ok ? "integration.connect.success" : "integration.connect.warning",
    eventSource: "processor",
    provider: input.provider,
    connectionId: connection.id,
    severity: testResult.ok ? "info" : "warning",
    summary: `${profile.full_name} connected ${provider.name} account ${connection.account_identifier}.`,
    metadata: {
      status: connection.status,
      auth_type: input.auth_type,
      environment: input.environment,
      test_message: testResult.message,
      credentials: redactCredentialsForLog(input.credentials),
    },
  });

  await writeAuditLog(supabase, profile, {
    action: "integration.processor.connect",
    entityType: "processor_connection",
    entityId: connection.id,
    summary: `${profile.full_name} connected ${provider.name} for ${connection.account_identifier}.`,
    metadata: { provider: input.provider, auth_type: input.auth_type, agent_profile_id: agentProfileId },
  });

  return NextResponse.json({ ok: true, connection: getConnectionPublicMetadata(connection), message: testResult.message }, { status: 201 });
}

async function readJson(request: Request) {
  try {
    return { ok: true as const, body: await request.json() };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Send a valid JSON body." }, { status: 400 }),
    };
  }
}
