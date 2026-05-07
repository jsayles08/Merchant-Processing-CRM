import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import type { CopilotAction, MerchantStatus } from "@/lib/types";

const merchantStatuses: MerchantStatus[] = [
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
];

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, profile } = await getSessionContext();

  const { data: action, error } = await supabase
    .from("copilot_actions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<CopilotAction>();

  if (error || !action) {
    return NextResponse.json({ ok: false, message: "Copilot action was not found." }, { status: 404 });
  }

  if (action.status !== "requires_confirmation") {
    return NextResponse.json({ ok: false, message: "This action is not waiting for confirmation." }, { status: 409 });
  }

  const payload = action.payload ?? {};
  let merchantId = action.merchant_id ?? (typeof payload.merchant_id === "string" ? payload.merchant_id : null);
  let completionMessage = "Action confirmed.";
  let completed = false;

  if (action.action_type === "create_merchant") {
    const { data: currentAgent } = await supabase
      .from("agents")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle<{ id: string }>();
    let assignedAgentId = currentAgent?.id ?? null;
    if (!assignedAgentId) {
      const { data: fallbackAgent } = await supabase
        .from("agents")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string }>();
      assignedAgentId = fallbackAgent?.id ?? null;
    }

    if (!assignedAgentId) {
      return NextResponse.json({ ok: false, message: "Create an agent record before Copilot can create merchants." }, { status: 403 });
    }

    const businessName =
      typeof payload.business_name === "string" && payload.business_name.trim()
        ? payload.business_name.trim()
        : typeof payload.source_text === "string"
          ? extractBusinessName(payload.source_text)
          : "New Merchant Lead";
    const status = typeof payload.status === "string" && isMerchantStatus(payload.status) ? payload.status : "lead";
    const proposedRate = typeof payload.proposed_rate === "number" ? payload.proposed_rate : 1.65;
    const monthlyVolume = typeof payload.monthly_volume_estimate === "number" ? payload.monthly_volume_estimate : 0;

    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .insert({
        business_name: businessName,
        contact_name: typeof payload.contact_name === "string" ? payload.contact_name : "Primary Contact",
        contact_email: typeof payload.contact_email === "string" ? payload.contact_email : null,
        contact_phone: typeof payload.contact_phone === "string" ? payload.contact_phone : null,
        business_address: "",
        industry: typeof payload.industry === "string" ? payload.industry : "Uncategorized",
        monthly_volume_estimate: monthlyVolume,
        average_ticket: typeof payload.average_ticket === "number" ? payload.average_ticket : 0,
        current_processor: typeof payload.current_processor === "string" ? payload.current_processor : null,
        proposed_rate: proposedRate,
        status,
        assigned_agent_id: assignedAgentId,
        notes: typeof payload.source_text === "string" ? payload.source_text : action.action_summary,
      })
      .select("id")
      .single<{ id: string }>();

    if (merchantError || !merchant) throw merchantError ?? new Error("Merchant was not created.");

    const { error: dealError } = await supabase.from("deals").insert({
      merchant_id: merchant.id,
      agent_id: assignedAgentId,
      stage: status,
      proposed_rate: proposedRate,
      estimated_monthly_volume: monthlyVolume,
      estimated_residual: Math.round(monthlyVolume * (proposedRate / 100) * 0.28),
      close_probability: status === "processing" ? 100 : 25,
    });
    if (dealError) throw dealError;

    merchantId = merchant.id;
    completionMessage = "Merchant lead created.";
    completed = true;
  }

  if (action.action_type === "update_stage" && merchantId && typeof payload.status === "string" && isMerchantStatus(payload.status)) {
    const status = payload.status as MerchantStatus;
    const merchantUpdate = await supabase.from("merchants").update({ status }).eq("id", merchantId);
    if (merchantUpdate.error) throw merchantUpdate.error;

    await supabase.from("deals").update({ stage: status }).eq("merchant_id", merchantId);
    completionMessage = "Merchant stage updated.";
    completed = true;
  }

  if (action.action_type === "add_merchant_update" && merchantId) {
    const { data: currentAgent } = await supabase
      .from("agents")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle<{ id: string }>();

    let actionAgentId = currentAgent?.id ?? null;
    if (!actionAgentId && merchantId) {
      const { data: merchant } = await supabase
        .from("merchants")
        .select("assigned_agent_id")
        .eq("id", merchantId)
        .maybeSingle<{ assigned_agent_id: string }>();
      actionAgentId = merchant?.assigned_agent_id ?? null;
    }

    if (!actionAgentId) {
      return NextResponse.json({ ok: false, message: "No agent record is attached to your profile." }, { status: 403 });
    }

    const note = typeof payload.note === "string" ? payload.note : action.action_summary;
    const updateType = typeof payload.update_type === "string" ? payload.update_type : "note";

    const update = await supabase.from("merchant_updates").insert({
      merchant_id: merchantId,
      agent_id: actionAgentId,
      update_type: updateType,
      note,
    });

    if (update.error) throw update.error;
    completionMessage = "Merchant update added.";
    completed = true;
  }

  if (action.action_type === "create_task") {
    const task = await supabase.from("tasks").insert({
      title: typeof payload.title === "string" ? payload.title : action.action_summary,
      description: action.action_summary,
      assigned_to: profile.id,
      merchant_id: merchantId,
      due_date: new Date(Date.now() + 86_400_000).toISOString(),
      priority: isPriority(payload.priority) ? payload.priority : "medium",
      status: "open",
    });

    if (task.error) throw task.error;
    completionMessage = "Task created.";
    completed = true;
  }

  const { error: updateError } = await supabase
    .from("copilot_actions")
    .update({
      merchant_id: merchantId ?? action.merchant_id,
      status: completed ? "completed" : "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", action.id);

  if (updateError) throw updateError;

  await writeAuditLog(supabase, profile, {
    action: "copilot.action_confirmed",
    entityType: "copilot_action",
    entityId: action.id,
    summary: `${profile.full_name} confirmed Copilot action: ${action.action_summary}`,
    metadata: {
      action_type: action.action_type,
      status: completed ? "completed" : "confirmed",
      merchant_id: merchantId,
    },
  });

  revalidatePath("/");
  revalidatePath("/copilot");
  revalidatePath("/messages");
  revalidatePath("/merchants");
  if (merchantId) revalidatePath(`/merchants/${merchantId}`);

  return NextResponse.json({ ok: true, message: completionMessage, status: completed ? "completed" : "confirmed" });
}

function isMerchantStatus(value: string): value is MerchantStatus {
  return merchantStatuses.includes(value as MerchantStatus);
}

function isPriority(value: unknown): value is "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high";
}

function extractBusinessName(sourceText: string) {
  const calledMatch = sourceText.match(/called\s+([^.,]+?)(?:\s+contact|\s+wants|\.|,|$)/i);
  const merchantMatch = sourceText.match(/merchant\s+(?:called|named)?\s*([^.,]+?)(?:\s+contact|\s+wants|\.|,|$)/i);
  return (calledMatch?.[1] || merchantMatch?.[1] || "New Merchant Lead").trim();
}
