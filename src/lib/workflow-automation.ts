import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAgentActivity } from "@/lib/activity";
import { writeAuditLog } from "@/lib/audit";
import type {
  Merchant,
  MerchantOnboardingStatus,
  MerchantStatus,
  Profile,
  SignatureEntityType,
  SignatureStatus,
  UnderwritingDecisionStatus,
} from "@/lib/types";

type WorkflowActor = Pick<Profile, "id" | "full_name">;

export type OpportunityAutomationEvent =
  | {
      type: "merchant_update_logged";
      updateType: string;
      updateId?: string | null;
      source: "merchant_update" | "copilot";
    }
  | {
      type: "merchant_profile_updated";
      source: "merchant_profile" | "copilot";
    }
  | {
      type: "signature_request_sent";
      signatureRequestId: string;
      signatureStatus: SignatureStatus;
      relatedEntityType: SignatureEntityType;
      source: "signature_request" | "copilot";
    }
  | {
      type: "merchant_onboarding_status_changed";
      onboardingId: string;
      onboardingStatus: MerchantOnboardingStatus;
      source: "merchant_onboarding";
    }
  | {
      type: "underwriting_decision_recorded";
      onboardingId: string;
      decisionId: string | null;
      decision: UnderwritingDecisionStatus;
      source: "underwriting";
    };

export type OpportunityStageTransition = {
  previousStage: MerchantStatus;
  newStage: MerchantStatus;
  reason: string;
  triggerEvent: string;
  automatic: boolean;
};

const stageRank: Partial<Record<MerchantStatus, number>> = {
  lead: 0,
  contacted: 10,
  qualified: 20,
  application_sent: 30,
  underwriting: 40,
  approved: 50,
  onboarded: 60,
  processing: 70,
  lost: 90,
  inactive: 90,
};

const outreachUpdateTypes = new Set(["call", "email", "meeting", "sms"]);

export function evaluateOpportunityStageAutomation(
  merchant: Pick<
    Merchant,
    | "status"
    | "contact_name"
    | "contact_email"
    | "contact_phone"
    | "monthly_volume_estimate"
    | "average_ticket"
    | "current_processor"
    | "proposed_rate"
  >,
  event: OpportunityAutomationEvent,
): Omit<OpportunityStageTransition, "previousStage" | "automatic"> | null {
  if (merchant.status === "inactive" || merchant.status === "lost") return null;

  if (event.type === "merchant_update_logged") {
    const normalizedUpdateType = event.updateType.trim().toLowerCase();
    if (merchant.status === "lead" && outreachUpdateTypes.has(normalizedUpdateType)) {
      return {
        newStage: "contacted",
        triggerEvent: event.type,
        reason: `${titleCase(normalizedUpdateType)} update logged by the assigned agent.`,
      };
    }

    if (merchant.status === "contacted" && hasQualificationDetails(merchant)) {
      return {
        newStage: "qualified",
        triggerEvent: event.type,
        reason: "Merchant has the core qualification details needed for the next sales step.",
      };
    }
  }

  if (event.type === "merchant_profile_updated" && ["lead", "contacted"].includes(merchant.status) && hasQualificationDetails(merchant)) {
    return {
      newStage: "qualified",
      triggerEvent: event.type,
      reason: "Merchant profile now has the core qualification details needed for the next sales step.",
    };
  }

  if (
    event.type === "signature_request_sent" &&
    event.signatureStatus === "sent" &&
    event.relatedEntityType === "merchant"
  ) {
    return {
      newStage: "application_sent",
      triggerEvent: event.type,
      reason: "Application or signature package was sent to the merchant.",
    };
  }

  if (event.type === "merchant_onboarding_status_changed") {
    const mappedStage = mapOnboardingStatusToOpportunityStage(event.onboardingStatus);
    if (!mappedStage) return null;
    return {
      newStage: mappedStage,
      triggerEvent: event.type,
      reason: `Merchant onboarding moved to ${titleCase(event.onboardingStatus)}.`,
    };
  }

  if (event.type === "underwriting_decision_recorded") {
    const mappedStage = mapUnderwritingDecisionToOpportunityStage(event.decision);
    return {
      newStage: mappedStage,
      triggerEvent: event.type,
      reason: `Underwriting automation routed the application to ${titleCase(event.decision)}.`,
    };
  }

  return null;
}

export async function applyOpportunityStageAutomation(
  supabase: SupabaseClient,
  actor: WorkflowActor,
  merchantId: string | null | undefined,
  event: OpportunityAutomationEvent,
) {
  if (!merchantId) return null;

  const { data: merchant, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", merchantId)
    .maybeSingle<Merchant>();

  if (error || !merchant) {
    if (error) {
      await writeAgentActivity(supabase, {
        profileId: actor.id,
        actorProfileId: actor.id,
        eventType: "opportunity.stage_automation.failed",
        eventSource: event.source,
        severity: "warning",
        summary: error.message,
        metadata: { merchant_id: merchantId, event_type: event.type },
      });
    }
    return null;
  }

  const transition = evaluateOpportunityStageAutomation(merchant, event);
  if (!transition || !isForwardTransition(merchant.status, transition.newStage)) return null;

  try {
    return await updateOpportunityStage(supabase, actor, {
      merchantId,
      newStage: transition.newStage,
      reason: transition.reason,
      triggerEvent: transition.triggerEvent,
      automatic: true,
      metadata: {
        event,
      },
    });
  } catch (error) {
    await writeAgentActivity(supabase, {
      profileId: actor.id,
      actorProfileId: actor.id,
      eventType: "opportunity.stage_automation.failed",
      eventSource: event.source,
      severity: "warning",
      summary: error instanceof Error ? error.message : "Opportunity stage automation failed.",
      metadata: {
        merchant_id: merchantId,
        event_type: event.type,
        target_stage: transition.newStage,
      },
    });
    return null;
  }
}

export async function updateOpportunityStage(
  supabase: SupabaseClient,
  actor: WorkflowActor,
  input: {
    merchantId: string;
    newStage: MerchantStatus;
    reason: string;
    triggerEvent: string;
    automatic: boolean;
    metadata?: Record<string, unknown>;
  },
): Promise<OpportunityStageTransition | null> {
  const { data: merchant, error: merchantLookupError } = await supabase
    .from("merchants")
    .select("id,status,business_name")
    .eq("id", input.merchantId)
    .maybeSingle<Pick<Merchant, "id" | "status" | "business_name">>();

  if (merchantLookupError || !merchant) {
    if (merchantLookupError) {
      await writeAgentActivity(supabase, {
        profileId: actor.id,
        actorProfileId: actor.id,
        eventType: "opportunity.stage_update.failed",
        eventSource: "workflow",
        severity: "warning",
        summary: merchantLookupError.message,
        metadata: { merchant_id: input.merchantId, target_stage: input.newStage },
      });
    }
    return null;
  }

  if (merchant.status === input.newStage) return null;

  const { error: merchantError } = await supabase
    .from("merchants")
    .update({ status: input.newStage })
    .eq("id", input.merchantId);

  if (merchantError) throw merchantError;

  const { error: dealError } = await supabase
    .from("deals")
    .update({ stage: input.newStage })
    .eq("merchant_id", input.merchantId);

  if (dealError) throw dealError;

  const transition: OpportunityStageTransition = {
    previousStage: merchant.status,
    newStage: input.newStage,
    reason: input.reason,
    triggerEvent: input.triggerEvent,
    automatic: input.automatic,
  };

  await writeAuditLog(supabase, actor, {
    action: input.automatic ? "merchant.stage_auto_advance" : "merchant.status_update",
    entityType: "merchant",
    entityId: input.merchantId,
    summary: input.automatic
      ? `${actor.full_name} triggered automatic pipeline movement for ${merchant.business_name}.`
      : `${actor.full_name} moved ${merchant.business_name} to ${input.newStage}.`,
    metadata: {
      previous_stage: transition.previousStage,
      new_stage: transition.newStage,
      trigger_event: transition.triggerEvent,
      reason: transition.reason,
      automatic: transition.automatic,
      ...input.metadata,
    },
  });

  if (input.automatic) {
    await writeAgentActivity(supabase, {
      profileId: actor.id,
      actorProfileId: actor.id,
      eventType: "opportunity.stage_auto_advance",
      eventSource: "workflow",
      summary: `${merchant.business_name} moved from ${transition.previousStage} to ${transition.newStage}.`,
      metadata: {
        merchant_id: input.merchantId,
        previous_stage: transition.previousStage,
        new_stage: transition.newStage,
        trigger_event: transition.triggerEvent,
        reason: transition.reason,
      },
    });
  }

  return transition;
}

function hasQualificationDetails(
  merchant: Pick<
    Merchant,
    | "contact_name"
    | "contact_email"
    | "contact_phone"
    | "monthly_volume_estimate"
    | "average_ticket"
    | "current_processor"
    | "proposed_rate"
  >,
) {
  return Boolean(
    merchant.contact_name?.trim() &&
      (merchant.contact_email?.trim() || merchant.contact_phone?.trim()) &&
      merchant.monthly_volume_estimate > 0 &&
      merchant.average_ticket > 0 &&
      merchant.current_processor?.trim() &&
      merchant.proposed_rate > 0,
  );
}

function isForwardTransition(previousStage: MerchantStatus, newStage: MerchantStatus) {
  return (stageRank[newStage] ?? -1) > (stageRank[previousStage] ?? -1);
}

function mapOnboardingStatusToOpportunityStage(status: MerchantOnboardingStatus): MerchantStatus | null {
  if (status === "contacted") return "contacted";
  if (status === "application_started") return "application_sent";
  if (status === "documents_needed" || status === "under_review") return "underwriting";
  if (status === "approved") return "approved";
  if (status === "active") return "onboarded";
  if (status === "declined") return "lost";
  return null;
}

function mapUnderwritingDecisionToOpportunityStage(decision: UnderwritingDecisionStatus): MerchantStatus {
  if (decision === "approved") return "approved";
  if (decision === "declined") return "lost";
  return "underwriting";
}

function titleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
