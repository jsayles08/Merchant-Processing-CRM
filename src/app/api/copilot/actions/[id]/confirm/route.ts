import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { calculateResidualBreakdown } from "@/lib/processor-pricing";
import { applyOpportunityStageAutomation, updateOpportunityStage } from "@/lib/workflow-automation";
import type { CompensationRule, CopilotAction, MerchantStatus, ProcessorPricingSetting } from "@/lib/types";

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

    const [processorPricingSettings, compensationRule] = await Promise.all([
      loadProcessorPricingSettings(supabase),
      loadCompensationRule(supabase),
    ]);
    const processorName = typeof payload.current_processor === "string" ? payload.current_processor : null;
    const residualEstimate = calculateResidualBreakdown({
      processingVolume: monthlyVolume,
      proposedRatePercent: proposedRate,
      processorName,
      pricingSettings: processorPricingSettings,
      compensationRule,
    });

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
        current_processor: processorName,
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
      estimated_residual: residualEstimate.netResidual,
      close_probability: status === "processing" ? 100 : 25,
    });
    if (dealError) throw dealError;

    merchantId = merchant.id;
    completionMessage = "Merchant lead created.";
    completed = true;
  }

  if (action.action_type === "update_stage" && merchantId && typeof payload.status === "string" && isMerchantStatus(payload.status)) {
    const status = payload.status as MerchantStatus;
    await updateOpportunityStage(supabase, profile, {
      merchantId,
      newStage: status,
      reason: "Manual Copilot-confirmed pipeline stage update.",
      triggerEvent: "copilot_stage_update",
      automatic: false,
      metadata: { action_id: action.id, action_type: action.action_type },
    });
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

    const update = await supabase
      .from("merchant_updates")
      .insert({
        merchant_id: merchantId,
        agent_id: actionAgentId,
        update_type: updateType,
        note,
        next_follow_up_date: parseDueDate(payload.next_follow_up_date),
      })
      .select("id")
      .single<{ id: string }>();

    if (update.error) throw update.error;
    await applyOpportunityStageAutomation(supabase, profile, merchantId, {
      type: "merchant_update_logged",
      updateType,
      updateId: update.data?.id ?? null,
      source: "copilot",
    });
    completionMessage = "Merchant update added.";
    completed = true;
  }

  if (action.action_type === "update_merchant_profile" && merchantId) {
    const merchantPatch: Record<string, unknown> = {};
    if (typeof payload.business_name === "string" && payload.business_name.trim()) merchantPatch.business_name = payload.business_name.trim();
    if (typeof payload.contact_name === "string" && payload.contact_name.trim()) merchantPatch.contact_name = payload.contact_name.trim();
    if (typeof payload.contact_email === "string" && payload.contact_email.trim()) merchantPatch.contact_email = payload.contact_email.trim();
    if (typeof payload.contact_phone === "string" && payload.contact_phone.trim()) merchantPatch.contact_phone = payload.contact_phone.trim();
    if (typeof payload.industry === "string" && payload.industry.trim()) merchantPatch.industry = payload.industry.trim();
    if (typeof payload.current_processor === "string" && payload.current_processor.trim()) merchantPatch.current_processor = payload.current_processor.trim();
    if (typeof payload.monthly_volume_estimate === "number") merchantPatch.monthly_volume_estimate = payload.monthly_volume_estimate;
    if (typeof payload.average_ticket === "number") merchantPatch.average_ticket = payload.average_ticket;
    if (typeof payload.proposed_rate === "number") merchantPatch.proposed_rate = payload.proposed_rate;
    if (typeof payload.notes === "string" && payload.notes.trim()) merchantPatch.notes = payload.notes.trim();

    if (!Object.keys(merchantPatch).length) {
      return NextResponse.json({ ok: false, message: "No merchant profile fields were provided to update." }, { status: 400 });
    }

    const merchantUpdate = await supabase.from("merchants").update(merchantPatch).eq("id", merchantId);
    if (merchantUpdate.error) throw merchantUpdate.error;

    const dealPatch: Record<string, unknown> = {};
    if (typeof payload.monthly_volume_estimate === "number") {
      dealPatch.estimated_monthly_volume = payload.monthly_volume_estimate;
    }
    if (typeof payload.proposed_rate === "number") {
      dealPatch.proposed_rate = payload.proposed_rate;
    }
    if (
      "monthly_volume_estimate" in merchantPatch ||
      "proposed_rate" in merchantPatch ||
      "current_processor" in merchantPatch
    ) {
      const { data: updatedMerchant } = await supabase
        .from("merchants")
        .select("monthly_volume_estimate,proposed_rate,current_processor")
        .eq("id", merchantId)
        .maybeSingle<{
          monthly_volume_estimate: number;
          proposed_rate: number;
          current_processor: string | null;
        }>();

      if (updatedMerchant) {
        const [processorPricingSettings, compensationRule] = await Promise.all([
          loadProcessorPricingSettings(supabase),
          loadCompensationRule(supabase),
        ]);
        const estimate = calculateResidualBreakdown({
          processingVolume: updatedMerchant.monthly_volume_estimate,
          proposedRatePercent: updatedMerchant.proposed_rate,
          processorName: updatedMerchant.current_processor,
          pricingSettings: processorPricingSettings,
          compensationRule,
        });
        dealPatch.estimated_residual = estimate.netResidual;
      }
    }
    if (Object.keys(dealPatch).length) {
      const dealUpdate = await supabase.from("deals").update(dealPatch).eq("merchant_id", merchantId);
      if (dealUpdate.error) throw dealUpdate.error;
    }

    await applyOpportunityStageAutomation(supabase, profile, merchantId, {
      type: "merchant_profile_updated",
      source: "copilot",
    });
    completionMessage = "Merchant profile updated.";
    completed = true;
  }

  if (action.action_type === "create_task") {
    const task = await supabase.from("tasks").insert({
      title: typeof payload.title === "string" ? payload.title : action.action_summary,
      description: typeof payload.description === "string" ? payload.description : action.action_summary,
      assigned_to: profile.id,
      merchant_id: merchantId,
      due_date: parseDueDate(payload.due_date) ?? new Date(Date.now() + 86_400_000).toISOString(),
      priority: isPriority(payload.priority) ? payload.priority : "medium",
      status: "open",
    });

    if (task.error) throw task.error;
    completionMessage = "Task created.";
    completed = true;
  }

  if (action.action_type === "create_recruit") {
    const fullName = typeof payload.full_name === "string" && payload.full_name.trim() ? payload.full_name.trim() : null;
    if (!fullName) {
      return NextResponse.json({ ok: false, message: "Recruit name is required before Copilot can create a recruit." }, { status: 400 });
    }

    const { error: recruitError } = await supabase.from("agent_recruits").insert({
      full_name: fullName,
      email: typeof payload.email === "string" ? payload.email : "",
      phone: typeof payload.phone === "string" ? payload.phone : null,
      source: typeof payload.source === "string" ? payload.source : "Copilot",
      status: "new_lead",
      assigned_recruiter_id: profile.id,
      created_by: profile.id,
      follow_up_at: parseDueDate(payload.follow_up_at),
      notes: typeof payload.notes === "string" ? payload.notes : action.action_summary,
    });

    if (recruitError) throw recruitError;
    completionMessage = "Recruit created.";
    completed = true;
  }

  if (action.action_type === "create_merchant_onboarding") {
    const { data: currentAgent } = await supabase
      .from("agents")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle<{ id: string }>();
    const businessName =
      typeof payload.business_name === "string" && payload.business_name.trim()
        ? payload.business_name.trim()
        : typeof payload.source_text === "string"
          ? extractBusinessName(payload.source_text)
          : null;

    if (!businessName) {
      return NextResponse.json({ ok: false, message: "Business name is required before Copilot can create onboarding." }, { status: 400 });
    }

    const { error: onboardingError } = await supabase.from("merchant_onboarding_records").insert({
      business_name: businessName,
      contact_name: typeof payload.contact_name === "string" ? payload.contact_name : "Primary Contact",
      contact_email: typeof payload.contact_email === "string" ? payload.contact_email : null,
      contact_phone: typeof payload.contact_phone === "string" ? payload.contact_phone : null,
      industry: typeof payload.industry === "string" ? payload.industry : null,
      processing_needs: typeof payload.processing_needs === "string" ? payload.processing_needs : action.action_summary,
      monthly_volume_estimate: typeof payload.monthly_volume_estimate === "number" ? payload.monthly_volume_estimate : 0,
      average_ticket: typeof payload.average_ticket === "number" ? payload.average_ticket : 0,
      current_processor: typeof payload.current_processor === "string" ? payload.current_processor : null,
      status: "application_started",
      assigned_agent_id: currentAgent?.id ?? null,
      follow_up_at: parseDueDate(payload.follow_up_at),
      notes: typeof payload.notes === "string" ? payload.notes : action.action_summary,
    });

    if (onboardingError) throw onboardingError;
    completionMessage = "Merchant onboarding record created.";
    completed = true;
  }

  if (action.action_type === "create_signature_request") {
    const recipientEmail = typeof payload.recipient_email === "string" ? payload.recipient_email : null;
    if (!recipientEmail) {
      return NextResponse.json({ ok: false, message: "Recipient email is required before Copilot can create a signature request." }, { status: 400 });
    }

    const relatedEntityType = isSignatureEntityType(payload.related_entity_type) ? payload.related_entity_type : "merchant";
    const signatureStatus = payload.send_now === false ? "draft" : "sent";
    const { data: signature, error: signatureError } = await supabase
      .from("signature_requests")
      .insert({
        title: typeof payload.title === "string" ? payload.title : "Signature request",
        recipient_name: typeof payload.recipient_name === "string" ? payload.recipient_name : "Recipient",
        recipient_email: recipientEmail,
        recipient_profile_id: typeof payload.recipient_profile_id === "string" ? payload.recipient_profile_id : null,
        related_entity_type: relatedEntityType,
        related_entity_id: typeof payload.related_entity_id === "string" ? payload.related_entity_id : merchantId,
        document_id: typeof payload.document_id === "string" ? payload.document_id : null,
        provider: "manual",
        status: signatureStatus,
        metadata: { created_by_copilot: true, summary: action.action_summary },
        created_by: profile.id,
        sent_at: payload.send_now === false ? null : new Date().toISOString(),
      })
      .select("id,related_entity_id")
      .single<{ id: string; related_entity_id: string | null }>();

    if (signatureError) throw signatureError;
    if (signatureStatus === "sent" && relatedEntityType === "merchant") {
      await applyOpportunityStageAutomation(supabase, profile, signature?.related_entity_id ?? merchantId, {
        type: "signature_request_sent",
        signatureRequestId: signature?.id ?? action.id,
        signatureStatus,
        relatedEntityType,
        source: "copilot",
      });
    }
    completionMessage = "Signature request created.";
    completed = true;
  }

  if (action.action_type === "knowledge_capture") {
    const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Company knowledge";
    const content = typeof payload.content === "string" && payload.content.trim() ? payload.content.trim() : null;
    if (!content) {
      return NextResponse.json({ ok: false, message: "Knowledge content is required before Copilot can save memory." }, { status: 400 });
    }

    const { error: memoryError } = await supabase.from("copilot_memories").insert({
      scope: isMemoryScope(payload.scope) ? payload.scope : "company",
      title,
      content,
      entity_id: typeof payload.entity_id === "string" ? payload.entity_id : merchantId,
      confidence: typeof payload.confidence === "number" ? payload.confidence : 0.8,
      source_type: "confirmed_action",
      source_id: action.id,
      metadata: { action_type: action.action_type },
      created_by: profile.id,
    });

    if (memoryError) throw memoryError;
    completionMessage = "Copilot memory saved.";
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

  revalidatePath("/dashboard");
  revalidatePath("/copilot");
  revalidatePath("/messages");
  revalidatePath("/merchants");
  revalidatePath("/opportunities");
  revalidatePath("/recruitment");
  revalidatePath("/merchant-onboarding");
  revalidatePath("/documents");
  revalidatePath("/settings");
  if (merchantId) revalidatePath(`/merchants/${merchantId}`);

  return NextResponse.json({ ok: true, message: completionMessage, status: completed ? "completed" : "confirmed" });
}

function isMerchantStatus(value: string): value is MerchantStatus {
  return merchantStatuses.includes(value as MerchantStatus);
}

function isPriority(value: unknown): value is "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high";
}

function isSignatureEntityType(value: unknown): value is "agent" | "recruit" | "merchant" | "account" {
  return value === "agent" || value === "recruit" || value === "merchant" || value === "account";
}

function isMemoryScope(value: unknown): value is "company" | "merchant" | "agent" | "user" {
  return value === "company" || value === "merchant" || value === "agent" || value === "user";
}

function parseDueDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractBusinessName(sourceText: string) {
  const calledMatch = sourceText.match(/called\s+([^.,]+?)(?:\s+contact|\s+wants|\.|,|$)/i);
  const merchantMatch = sourceText.match(/merchant\s+(?:called|named)?\s*([^.,]+?)(?:\s+contact|\s+wants|\.|,|$)/i);
  return (calledMatch?.[1] || merchantMatch?.[1] || "New Merchant Lead").trim();
}

async function loadProcessorPricingSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("processor_pricing_settings")
    .select("*")
    .order("effective_at", { ascending: false })
    .returns<ProcessorPricingSetting[]>();

  if (error) {
    console.warn("Processor pricing settings are not available yet.", error.message);
    return [];
  }

  return data ?? [];
}

async function loadCompensationRule(supabase: SupabaseClient): Promise<CompensationRule> {
  const { data } = await supabase
    .from("compensation_rules")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<CompensationRule[]>();

  return data?.[0] ?? {
    id: "default",
    rule_name: "MerchantDesk Standard Agent Plan",
    base_residual_percentage: 40,
    minimum_processing_rate: 1.5,
    override_per_active_recruit: 0.25,
    max_override_per_team: 1,
    active_recruit_required_merchants: 2,
    active_recruit_required_processing_days: 90,
    created_at: new Date(0).toISOString(),
  };
}
