import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import type { CopilotAction, MerchantStatus } from "@/lib/types";

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
  const merchantId = action.merchant_id ?? (typeof payload.merchant_id === "string" ? payload.merchant_id : null);
  let completionMessage = "Action confirmed.";
  let completed = false;

  if (action.action_type === "update_stage" && merchantId && typeof payload.status === "string") {
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

    if (!currentAgent?.id) {
      return NextResponse.json({ ok: false, message: "No agent record is attached to your profile." }, { status: 403 });
    }

    const note = typeof payload.note === "string" ? payload.note : action.action_summary;
    const updateType = typeof payload.update_type === "string" ? payload.update_type : "note";

    const update = await supabase.from("merchant_updates").insert({
      merchant_id: merchantId,
      agent_id: currentAgent.id,
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
      priority: typeof payload.priority === "string" ? payload.priority : "medium",
      status: "open",
    });

    if (task.error) throw task.error;
    completionMessage = "Task created.";
    completed = true;
  }

  const { error: updateError } = await supabase
    .from("copilot_actions")
    .update({
      status: completed ? "completed" : "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", action.id);

  if (updateError) throw updateError;

  return NextResponse.json({ ok: true, message: completionMessage, status: completed ? "completed" : "confirmed" });
}
