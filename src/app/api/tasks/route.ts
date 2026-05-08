import { NextResponse } from "next/server";
import { z } from "zod";
import { getIntegrationAuthError } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

const PrioritySchema = z.enum(["low", "medium", "high"]);
const TaskStatusSchema = z.enum(["open", "completed", "overdue"]);
const OptionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const OptionalEmail = z.preprocess((value) => (value === "" ? undefined : value), z.string().email().optional());

const TaskQuerySchema = z.object({
  status: z.preprocess((value) => (value === "" || value === "all" ? undefined : value), TaskStatusSchema.optional()),
  assignedTo: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
  merchantId: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const TaskCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    description: OptionalString,
    assigned_to: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
    assigned_to_email: OptionalEmail,
    merchant_id: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
    due_date: z.string().min(1),
    priority: PrioritySchema.default("medium"),
  })
  .refine((data) => data.assigned_to || data.assigned_to_email, {
    message: "Provide assigned_to or assigned_to_email.",
    path: ["assigned_to"],
  });

export async function GET(request: Request) {
  const authError = getIntegrationAuthError(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = TaskQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 503 });
  }
  const { limit, offset, status, assignedTo, merchantId } = parsed.data;
  let query = supabase
    .from("tasks")
    .select("*", { count: "exact" })
    .order("due_date", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (merchantId) query = query.eq("merchant_id", merchantId);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    tasks: data ?? [],
    pagination: { limit, offset, count: count ?? 0 },
  });
}

export async function POST(request: Request) {
  const authError = getIntegrationAuthError(request);
  if (authError) return authError;

  const payload = await readJson(request);
  if (!payload.ok) return payload.response;

  const parsed = TaskCreateSchema.safeParse(payload.body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const dueDate = new Date(parsed.data.due_date);
  if (Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ ok: false, error: "Choose a valid task due_date." }, { status: 400 });
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 503 });
  }

  let assignedProfileId: string | null;
  try {
    assignedProfileId = await resolveAssignedProfileId(supabase, parsed.data.assigned_to, parsed.data.assigned_to_email);
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }

  if (!assignedProfileId) {
    return NextResponse.json({ ok: false, error: "Assigned profile was not found." }, { status: 404 });
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      assigned_to: assignedProfileId,
      merchant_id: parsed.data.merchant_id ?? null,
      due_date: dueDate.toISOString(),
      priority: parsed.data.priority,
      status: "open",
    })
    .select("*")
    .single<Task>();

  if (error || !task) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Task was not created." }, { status: 500 });
  }

  await supabase.from("notifications").insert({
    profile_id: task.assigned_to,
    title: "Task assigned",
    body: `${task.title} was created through the MerchantDesk API.`,
    url: task.merchant_id ? `/tasks?merchant=${task.merchant_id}` : "/tasks",
    dedupe_key: `api-task-created:${task.id}`,
  });

  await writeAuditLog(supabase, null, {
    action: "api.task.create",
    entityType: "task",
    entityId: task.id,
    summary: `Integration API created task ${task.title}.`,
    metadata: {
      assigned_to: task.assigned_to,
      assigned_to_email: parsed.data.assigned_to_email ?? null,
      merchant_id: task.merchant_id,
      priority: task.priority,
    },
  });

  return NextResponse.json({ ok: true, task }, { status: 201 });
}

async function resolveAssignedProfileId(
  supabase: ReturnType<typeof createAdminClient>,
  assignedProfileId?: string,
  assignedProfileEmail?: string,
) {
  if (assignedProfileId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", assignedProfileId)
      .maybeSingle<{ id: string }>();

    if (error) throw error;
    return data?.id ?? null;
  }

  if (!assignedProfileEmail) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", assignedProfileEmail.toLowerCase())
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return data?.id ?? null;
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to run integration request.";
}
