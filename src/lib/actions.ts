"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { brand } from "@/lib/branding";
import { normalizeImportMonth, parseProcessorResidualCsv } from "@/lib/residual-import";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MerchantStatus, Task, TaskStatus } from "@/lib/types";

export type ActionResult = {
  ok: boolean;
  message: string;
  data?: unknown;
};

const MerchantInput = z.object({
  business_name: z.string().min(1),
  contact_name: z.string().min(1),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  industry: z.string().optional(),
  monthly_volume_estimate: z.coerce.number().nonnegative(),
  average_ticket: z.coerce.number().nonnegative(),
  current_processor: z.string().optional(),
  proposed_rate: z.coerce.number().nonnegative(),
  status: z.string(),
  notes: z.string().optional(),
  assigned_agent_id: z.string().optional(),
});

const CreateTeamMemberInput = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["admin", "manager", "agent"]),
  status: z.enum(["active", "invited", "inactive"]).default("active"),
  manager_id: z.string().optional(),
  agent_code: z.string().optional(),
  sponsor_agent_id: z.string().optional(),
  temp_password: z.string().min(8),
});

const TaskInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigned_to: z.string().min(1),
  merchant_id: z.string().optional(),
  due_date: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]),
});

const BulkAssignProfilesInput = z.object({
  profile_ids: z.array(z.string().uuid()).min(1),
  manager_id: z.string().uuid().nullable().optional(),
});

const BulkReassignMerchantsInput = z.object({
  from_agent_id: z.string().uuid(),
  to_agent_id: z.string().uuid(),
});

const ResidualImportInput = z.object({
  processor_name: z.string().min(1).default("Processor report"),
  statement_month: z.string().min(1),
  csv_text: z.string().min(1),
});

export async function createMerchantAction(input: unknown): Promise<ActionResult> {
  const parsed = MerchantInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please complete the required merchant fields." };
  }

  const { supabase, profile } = await getSessionContext();
  const { data: currentAgent } = await supabase.from("agents").select("id").eq("profile_id", profile.id).maybeSingle<{ id: string }>();
  const assignedAgentId =
    profile.role === "agent" ? currentAgent?.id : parsed.data.assigned_agent_id || currentAgent?.id;

  if (!assignedAgentId) {
    return { ok: false, message: "No agent record is available for assignment." };
  }

  const merchantPayload = {
    business_name: parsed.data.business_name,
    contact_name: parsed.data.contact_name,
    contact_email: parsed.data.contact_email || null,
    contact_phone: parsed.data.contact_phone || null,
    business_address: "",
    industry: parsed.data.industry || null,
    monthly_volume_estimate: parsed.data.monthly_volume_estimate,
    average_ticket: parsed.data.average_ticket,
    current_processor: parsed.data.current_processor || null,
    proposed_rate: parsed.data.proposed_rate,
    status: parsed.data.status,
    assigned_agent_id: assignedAgentId,
    notes: parsed.data.notes || null,
  };

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .insert(merchantPayload)
    .select("*")
    .single();

  if (merchantError) {
    return { ok: false, message: merchantError.message };
  }

  const estimatedResidual = Math.round(
    parsed.data.monthly_volume_estimate * (parsed.data.proposed_rate / 100) * 0.28,
  );

  const { error: dealError } = await supabase.from("deals").insert({
    merchant_id: merchant.id,
    agent_id: assignedAgentId,
    stage: parsed.data.status,
    proposed_rate: parsed.data.proposed_rate,
    estimated_monthly_volume: parsed.data.monthly_volume_estimate,
    estimated_residual: estimatedResidual,
    close_probability: parsed.data.status === "processing" ? 100 : 25,
  });

  if (dealError) {
    return { ok: false, message: dealError.message };
  }

  await writeAuditLog(supabase, profile, {
    action: "merchant.create",
    entityType: "merchant",
    entityId: merchant.id,
    summary: `${profile.full_name} created merchant ${parsed.data.business_name}.`,
    metadata: { assigned_agent_id: assignedAgentId, status: parsed.data.status },
  });

  revalidatePath("/");
  return { ok: true, message: `${parsed.data.business_name} was created.`, data: merchant };
}

export async function updateMerchantStatusAction(merchantId: string, status: MerchantStatus): Promise<ActionResult> {
  const { supabase, profile } = await getSessionContext();
  const { error: merchantError } = await supabase.from("merchants").update({ status }).eq("id", merchantId);

  if (merchantError) {
    return { ok: false, message: merchantError.message };
  }

  const { error: dealError } = await supabase.from("deals").update({ stage: status }).eq("merchant_id", merchantId);

  if (dealError) {
    return { ok: false, message: dealError.message };
  }

  await writeAuditLog(supabase, profile, {
    action: "merchant.status_update",
    entityType: "merchant",
    entityId: merchantId,
    summary: `${profile.full_name} moved a merchant to ${status}.`,
    metadata: { status },
  });

  revalidatePath("/");
  revalidatePath(`/merchants/${merchantId}`);
  return { ok: true, message: "Merchant stage updated." };
}

export async function createMerchantUpdateAction(formData: FormData): Promise<ActionResult> {
  const merchantId = String(formData.get("merchant_id") ?? "");
  const note = String(formData.get("note") ?? "");
  const updateType = String(formData.get("update_type") ?? "note");
  const nextFollowUpDate = String(formData.get("next_follow_up_date") ?? "");

  if (!merchantId || !note) {
    return { ok: false, message: "Merchant and note are required." };
  }

  const { supabase, profile } = await getSessionContext();
  const { data: currentAgent } = await supabase.from("agents").select("id").eq("profile_id", profile.id).maybeSingle<{ id: string }>();

  if (!currentAgent?.id) {
    return { ok: false, message: "Only users with agent records can create merchant updates." };
  }

  const { error } = await supabase.from("merchant_updates").insert({
    merchant_id: merchantId,
    agent_id: currentAgent.id,
    update_type: updateType,
    note,
    next_follow_up_date: nextFollowUpDate || null,
  });

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "merchant.update_create",
    entityType: "merchant",
    entityId: merchantId,
    summary: `${profile.full_name} added a ${updateType} update.`,
    metadata: { update_type: updateType, next_follow_up_date: nextFollowUpDate || null },
  });

  revalidatePath("/");
  revalidatePath(`/merchants/${merchantId}`);
  return { ok: true, message: "Merchant update saved." };
}

export async function approveDealAction(dealId: string, approvalStatus: "approved" | "denied"): Promise<ActionResult> {
  const { supabase, profile } = await getSessionContext();

  if (profile.role === "agent") {
    return { ok: false, message: "Only managers and admins can approve pricing exceptions." };
  }

  const { error } = await supabase.from("deals").update({ approval_status: approvalStatus }).eq("id", dealId);

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "pricing.approval",
    entityType: "deal",
    entityId: dealId,
    summary: `${profile.full_name} ${approvalStatus} a pricing exception.`,
    metadata: { approval_status: approvalStatus },
  });

  revalidatePath("/");
  return { ok: true, message: `Deal ${approvalStatus}.` };
}

export async function uploadMerchantDocumentAction(formData: FormData): Promise<ActionResult> {
  const merchantId = String(formData.get("merchant_id") ?? "");
  const documentType = String(formData.get("document_type") ?? "Other");
  const file = formData.get("file");

  if (!merchantId || !(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a merchant document to upload." };
  }

  const { supabase, profile } = await getSessionContext();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${merchantId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("merchant-documents").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) return { ok: false, message: uploadError.message };

  const { error: documentError } = await supabase.from("documents").insert({
    merchant_id: merchantId,
    uploaded_by: profile.id,
    file_name: file.name,
    file_url: path,
    document_type: documentType,
  });

  if (documentError) return { ok: false, message: documentError.message };

  await writeAuditLog(supabase, profile, {
    action: "merchant.document_upload",
    entityType: "merchant",
    entityId: merchantId,
    summary: `${profile.full_name} uploaded ${file.name}.`,
    metadata: { document_type: documentType, storage_path: path },
  });

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath("/documents");
  return { ok: true, message: "Document uploaded." };
}

export async function createTeamMemberAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateTeamMemberInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Complete the required user fields." };
  }

  const { supabase, profile } = await getSessionContext();

  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can create users and agents." };
  }

  const adminSupabase = createAdminClient();
  const listed = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listed.error) {
    return { ok: false, message: listed.error.message };
  }

  let userId = listed.data.users.find((user) => user.email === parsed.data.email)?.id;

  if (!userId) {
    const created = await adminSupabase.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.temp_password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name },
    });

    if (created.error || !created.data.user) {
      return { ok: false, message: created.error?.message ?? "Unable to create Auth user." };
    }

    userId = created.data.user.id;
  } else {
    const updated = await adminSupabase.auth.admin.updateUserById(userId, {
      password: parsed.data.temp_password,
      user_metadata: { full_name: parsed.data.full_name },
    });

    if (updated.error) {
      return { ok: false, message: updated.error.message };
    }
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        role: parsed.data.role,
        phone: parsed.data.phone || null,
        status: parsed.data.status,
        manager_id: parsed.data.manager_id || null,
      },
      { onConflict: "email" },
    )
    .select("*")
    .single<{ id: string }>();

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  if (parsed.data.role === "agent") {
    const teamAssignment = await resolveTeamAssignment(supabase, parsed.data.sponsor_agent_id || null);
    const agentCode =
      parsed.data.agent_code?.trim() ||
      `CV-${parsed.data.full_name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const { data: agentRow, error: agentError } = await supabase
      .from("agents")
      .upsert(
        {
          profile_id: profileRow.id,
          agent_code: agentCode,
          sponsor_agent_id: parsed.data.sponsor_agent_id || null,
          team_number: teamAssignment.agentTeamNumber,
          team_position: teamAssignment.agentTeamPosition,
          status: "active",
          start_date: new Date().toISOString().slice(0, 10),
        },
        { onConflict: "profile_id" },
      )
      .select("*")
      .single<{ id: string }>();

    if (agentError) {
      return { ok: false, message: agentError.message };
    }

    if (teamAssignment.teamId && parsed.data.sponsor_agent_id) {
      const { error: memberError } = await supabase.from("team_members").upsert(
        {
          team_id: teamAssignment.teamId,
          agent_id: agentRow.id,
          sponsor_agent_id: parsed.data.sponsor_agent_id,
          active_recruit_status: false,
        },
        { onConflict: "team_id,agent_id" },
      );

      if (memberError) {
        return { ok: false, message: memberError.message };
      }
    }
  }

  await writeAuditLog(supabase, profile, {
    action: "user.upsert",
    entityType: "profile",
    entityId: profileRow.id,
    summary: `${profile.full_name} created or updated ${parsed.data.full_name}.`,
    metadata: { role: parsed.data.role, status: parsed.data.status, manager_id: parsed.data.manager_id || null },
  });

  revalidatePath("/");
  return { ok: true, message: `${parsed.data.full_name} is ready to use ${brand.companyName}.` };
}

export async function bulkAssignProfilesToManagerAction(input: unknown): Promise<ActionResult> {
  const parsed = BulkAssignProfilesInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose at least one profile to assign." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can change manager assignments." };
  }

  const managerId = parsed.data.manager_id || null;
  if (managerId) {
    const { data: manager, error: managerError } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", managerId)
      .single<{ id: string; role: string }>();

    if (managerError || !manager || !["manager", "admin"].includes(manager.role)) {
      return { ok: false, message: "Choose a manager or admin as the manager assignment." };
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ manager_id: managerId })
    .in("id", parsed.data.profile_ids)
    .neq("role", "admin")
    .select("id");

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "manager.bulk_assign",
    entityType: "profile",
    summary: `${profile.full_name} updated manager assignments for ${data?.length ?? 0} profiles.`,
    metadata: { profile_ids: parsed.data.profile_ids, manager_id: managerId },
  });

  revalidatePath("/");
  return { ok: true, message: `Updated ${data?.length ?? 0} manager assignments.` };
}

export async function bulkReassignMerchantsAction(input: unknown): Promise<ActionResult> {
  const parsed = BulkReassignMerchantsInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose the source and destination agents." };
  }

  if (parsed.data.from_agent_id === parsed.data.to_agent_id) {
    return { ok: false, message: "Choose two different agents." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can bulk reassign merchant books." };
  }

  const { data: merchants, error: merchantError } = await supabase
    .from("merchants")
    .update({ assigned_agent_id: parsed.data.to_agent_id })
    .eq("assigned_agent_id", parsed.data.from_agent_id)
    .select("id");

  if (merchantError) return { ok: false, message: merchantError.message };

  const merchantIds = (merchants ?? []).map((merchant) => merchant.id);
  if (merchantIds.length) {
    const { error: dealError } = await supabase
      .from("deals")
      .update({ agent_id: parsed.data.to_agent_id })
      .in("merchant_id", merchantIds);

    if (dealError) return { ok: false, message: dealError.message };
  }

  await writeAuditLog(supabase, profile, {
    action: "merchant.bulk_reassign",
    entityType: "merchant",
    summary: `${profile.full_name} reassigned ${merchantIds.length} merchants.`,
    metadata: {
      from_agent_id: parsed.data.from_agent_id,
      to_agent_id: parsed.data.to_agent_id,
      merchant_ids: merchantIds,
    },
  });

  revalidatePath("/");
  return { ok: true, message: `Reassigned ${merchantIds.length} merchants.` };
}

export async function importResidualReportAction(input: unknown): Promise<ActionResult> {
  const parsed = ResidualImportInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Upload a processor residual CSV and statement month." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can import processor residual reports." };
  }

  let statementMonth: string;
  try {
    statementMonth = normalizeImportMonth(parsed.data.statement_month);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Choose a valid statement month." };
  }

  const parsedCsv = parseProcessorResidualCsv(parsed.data.csv_text);

  const { data: batch, error: batchError } = await supabase
    .from("residual_import_batches")
    .insert({
      uploaded_by: profile.id,
      processor_name: parsed.data.processor_name,
      statement_month: statementMonth,
      row_count: parsedCsv.rows.length + parsedCsv.errors.length,
      error_count: parsedCsv.errors.length,
    })
    .select("id")
    .single<{ id: string }>();

  if (batchError) {
    console.warn("Residual import history is not available yet.", batchError.message);
  }

  const batchId = batch?.id ?? null;

  const { data: rules } = await supabase
    .from("compensation_rules")
    .select("base_residual_percentage")
    .order("created_at", { ascending: false })
    .limit(1);
  const baseResidualPercentage = Number(rules?.[0]?.base_residual_percentage ?? 40);
  const errors = [...parsedCsv.errors];
  const residualRows = [];

  for (const row of parsedCsv.rows) {
    const merchantQuery = row.merchant_id
      ? supabase.from("merchants").select("id,assigned_agent_id,business_name").eq("id", row.merchant_id)
      : supabase.from("merchants").select("id,assigned_agent_id,business_name").ilike("business_name", row.business_name ?? "");

    const { data: merchant, error } = await merchantQuery.maybeSingle<{
      id: string;
      assigned_agent_id: string;
      business_name: string;
    }>();

    if (error || !merchant) {
      errors.push(`Line ${row.lineNumber}: merchant was not found.`);
      continue;
    }

    const netResidual = row.net_residual;
    const agentResidualAmount = netResidual * (baseResidualPercentage / 100);
    residualRows.push({
      merchant_id: merchant.id,
      agent_id: row.agent_id || merchant.assigned_agent_id,
      month: row.month ? normalizeImportMonth(row.month) : statementMonth,
      processing_volume: row.processing_volume,
      net_residual: netResidual,
      agent_residual_amount: agentResidualAmount,
      company_share: netResidual - agentResidualAmount,
    });
  }

  if (residualRows.length) {
    const { error } = await supabase.from("residuals").upsert(residualRows, { onConflict: "merchant_id,month" });
    if (error) {
      errors.push(error.message);
    }
  }

  const status = errors.length ? (residualRows.length ? "completed" : "failed") : "completed";
  await supabase
  if (batchId) {
    await supabase
      .from("residual_import_batches")
      .update({
        imported_count: residualRows.length,
        error_count: errors.length,
        status,
        error_summary: errors.slice(0, 8).join("\n") || null,
      })
      .eq("id", batchId);
  }

  await writeAuditLog(supabase, profile, {
    action: "residual.import",
    entityType: "residual_import_batch",
    entityId: batchId,
    summary: `${profile.full_name} imported ${residualRows.length} residual rows from ${parsed.data.processor_name}.`,
    metadata: { imported_count: residualRows.length, error_count: errors.length, statement_month: statementMonth },
  });

  revalidatePath("/");
  return {
    ok: status === "completed",
    message: errors.length
      ? `Imported ${residualRows.length} rows with ${errors.length} issues.`
      : `Imported ${residualRows.length} residual rows.`,
    data: { importedCount: residualRows.length, errors },
  };
}

export async function createTaskAction(input: unknown): Promise<ActionResult> {
  const parsed = TaskInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Complete the required task fields." };
  }

  const { supabase } = await getSessionContext();
  const dueDate = new Date(parsed.data.due_date);
  if (Number.isNaN(dueDate.getTime())) {
    return { ok: false, message: "Choose a valid task due date." };
  }

  const { data, error } = await supabase.from("tasks").insert({
    title: parsed.data.title,
    description: parsed.data.description || null,
    assigned_to: parsed.data.assigned_to,
    merchant_id: parsed.data.merchant_id || null,
    due_date: dueDate.toISOString(),
    priority: parsed.data.priority,
    status: "open",
  }).select("*").single<Task>();

  if (error) return { ok: false, message: error.message };

  await supabase.from("notifications").insert({
    profile_id: data.assigned_to,
    title: "Task assigned",
    body: `${data.title} is due ${new Date(data.due_date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}.`,
    url: data.merchant_id ? `/tasks?merchant=${data.merchant_id}` : "/tasks",
    dedupe_key: `task-created:${data.id}`,
  });

  revalidatePath("/");
  revalidatePath("/notifications");
  return { ok: true, message: "Task created.", data };
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus): Promise<ActionResult> {
  const { supabase } = await getSessionContext();
  const { data, error } = await supabase.from("tasks").update({ status }).eq("id", taskId).select("*").single<Task>();

  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Task updated.", data };
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  const { supabase, profile } = await getSessionContext();
  const { error } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("profile_id", profile.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/notifications");
  return { ok: true, message: "Notification marked read." };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const { supabase, profile } = await getSessionContext();
  const { error } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("profile_id", profile.id)
    .eq("status", "unread");

  if (error) return { ok: false, message: error.message };

  revalidatePath("/notifications");
  return { ok: true, message: "All notifications marked read." };
}

async function resolveTeamAssignment(
  supabase: Awaited<ReturnType<typeof getSessionContext>>["supabase"],
  sponsorAgentId: string | null,
) {
  if (!sponsorAgentId) {
    return { agentTeamNumber: 1, agentTeamPosition: 1, teamId: null as string | null };
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id,team_number")
    .eq("leader_agent_id", sponsorAgentId)
    .order("team_number", { ascending: true });

  if (teamsError) throw teamsError;

  for (const team of teams ?? []) {
    const { count, error: countError } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id);

    if (countError) throw countError;

    if ((count ?? 0) < 4) {
      return {
        agentTeamNumber: team.team_number,
        agentTeamPosition: (count ?? 0) + 2,
        teamId: team.id as string,
      };
    }
  }

  const nextTeamNumber = ((teams ?? []).at(-1)?.team_number ?? 0) + 1;
  const { data: newTeam, error: teamError } = await supabase
    .from("teams")
    .insert({ leader_agent_id: sponsorAgentId, team_number: nextTeamNumber })
    .select("id")
    .single<{ id: string }>();

  if (teamError) throw teamError;

  return {
    agentTeamNumber: nextTeamNumber,
    agentTeamPosition: 2,
    teamId: newTeam.id,
  };
}
