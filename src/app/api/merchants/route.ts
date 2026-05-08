import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIntegrationAuthError } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agent, Merchant } from "@/lib/types";

export const dynamic = "force-dynamic";

const MerchantStatusSchema = z.enum([
  "lead",
  "contacted",
  "qualified",
  "application_sent",
  "underwriting",
  "approved",
  "onboarded",
  "processing",
  "inactive",
  "lost",
]);

const OptionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const OptionalEmail = z.preprocess((value) => (value === "" ? undefined : value), z.string().email().optional());

const MerchantQuerySchema = z.object({
  search: OptionalString,
  status: z.preprocess((value) => (value === "" || value === "all" ? undefined : value), MerchantStatusSchema.optional()),
  agentId: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const MerchantCreateSchema = z
  .object({
    business_name: z.string().trim().min(1).max(160),
    contact_name: z.string().trim().min(1).max(160),
    contact_email: OptionalEmail,
    contact_phone: OptionalString,
    business_address: OptionalString,
    industry: OptionalString,
    monthly_volume_estimate: z.coerce.number().nonnegative().default(0),
    average_ticket: z.coerce.number().nonnegative().default(0),
    current_processor: OptionalString,
    proposed_rate: z.coerce.number().nonnegative().default(1.5),
    status: MerchantStatusSchema.default("lead"),
    assigned_agent_id: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
    assigned_agent_email: OptionalEmail,
    notes: OptionalString,
  })
  .refine((data) => data.assigned_agent_id || data.assigned_agent_email, {
    message: "Provide assigned_agent_id or assigned_agent_email.",
    path: ["assigned_agent_id"],
  });

export async function GET(request: Request) {
  const authError = getIntegrationAuthError(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = MerchantQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 503 });
  }
  const { limit, offset, search, status, agentId } = parsed.data;
  let query = supabase
    .from("merchants")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (agentId) query = query.eq("assigned_agent_id", agentId);

  const safeSearch = normalizeSearchTerm(search);
  if (safeSearch) {
    query = query.or(
      [
        `business_name.ilike.%${safeSearch}%`,
        `contact_name.ilike.%${safeSearch}%`,
        `contact_email.ilike.%${safeSearch}%`,
        `industry.ilike.%${safeSearch}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    merchants: data ?? [],
    pagination: { limit, offset, count: count ?? 0 },
  });
}

export async function POST(request: Request) {
  const authError = getIntegrationAuthError(request);
  if (authError) return authError;

  const payload = await readJson(request);
  if (!payload.ok) return payload.response;

  const parsed = MerchantCreateSchema.safeParse(payload.body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 503 });
  }

  let assignedAgent: Pick<Agent, "id" | "profile_id"> | null;
  try {
    assignedAgent = await resolveAssignedAgent(supabase, parsed.data.assigned_agent_id, parsed.data.assigned_agent_email);
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }

  if (!assignedAgent) {
    return NextResponse.json({ ok: false, error: "Assigned agent was not found." }, { status: 404 });
  }

  const requiresApproval = parsed.data.proposed_rate < 1.5;
  const { data: merchant, error } = await supabase
    .from("merchants")
    .insert({
      business_name: parsed.data.business_name,
      contact_name: parsed.data.contact_name,
      contact_email: parsed.data.contact_email ?? null,
      contact_phone: parsed.data.contact_phone ?? null,
      business_address: parsed.data.business_address ?? null,
      industry: parsed.data.industry ?? null,
      monthly_volume_estimate: parsed.data.monthly_volume_estimate,
      average_ticket: parsed.data.average_ticket,
      current_processor: parsed.data.current_processor ?? null,
      proposed_rate: parsed.data.proposed_rate,
      status: parsed.data.status,
      assigned_agent_id: assignedAgent.id,
      notes: parsed.data.notes ?? null,
    })
    .select("*")
    .single<Merchant>();

  if (error || !merchant) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Merchant was not created." }, { status: 500 });
  }

  const { error: dealError } = await supabase.from("deals").insert({
    merchant_id: merchant.id,
    agent_id: assignedAgent.id,
    stage: parsed.data.status,
    proposed_rate: parsed.data.proposed_rate,
    requires_management_approval: requiresApproval,
    approval_status: requiresApproval ? "pending" : "not_required",
    estimated_monthly_volume: parsed.data.monthly_volume_estimate,
    estimated_residual: Math.round(parsed.data.monthly_volume_estimate * (parsed.data.proposed_rate / 100) * 0.28),
  });

  if (dealError) {
    return NextResponse.json(
      { ok: false, error: `Merchant was created but deal setup failed: ${dealError.message}`, merchant },
      { status: 500 },
    );
  }

  await supabase.from("notifications").insert({
    profile_id: assignedAgent.profile_id,
    title: "New merchant assigned",
    body: `${merchant.business_name} was added through the MerchantDesk API.`,
    url: `/merchants/${merchant.id}`,
    dedupe_key: `api-merchant-created:${merchant.id}`,
  });

  await writeAuditLog(supabase, null, {
    action: "api.merchant.create",
    entityType: "merchant",
    entityId: merchant.id,
    summary: `Integration API created merchant ${merchant.business_name}.`,
    metadata: {
      assigned_agent_id: assignedAgent.id,
      assigned_agent_email: parsed.data.assigned_agent_email ?? null,
      status: parsed.data.status,
      requires_approval: requiresApproval,
    },
  });

  return NextResponse.json({ ok: true, merchant }, { status: 201 });
}

async function resolveAssignedAgent(
  supabase: SupabaseClient,
  assignedAgentId?: string,
  assignedAgentEmail?: string,
) {
  if (assignedAgentId) {
    const { data, error } = await supabase
      .from("agents")
      .select("id,profile_id")
      .eq("id", assignedAgentId)
      .maybeSingle<Pick<Agent, "id" | "profile_id">>();

    if (error) throw error;
    return data ?? null;
  }

  if (!assignedAgentEmail) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", assignedAgentEmail.toLowerCase())
    .maybeSingle<{ id: string }>();

  if (profileError) throw profileError;
  if (!profile) return null;

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id,profile_id")
    .eq("profile_id", profile.id)
    .maybeSingle<Pick<Agent, "id" | "profile_id">>();

  if (agentError) throw agentError;
  return agent ?? null;
}

function normalizeSearchTerm(value?: string) {
  return value?.replace(/[%(),.]/g, " ").trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to run integration request.";
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
