import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import type {
  MerchantOnboardingRecord,
  MerchantOnboardingStep,
  Profile,
  UnderwritingDecisionStatus,
  UnderwritingOutcome,
  UnderwritingRule,
} from "@/lib/types";

export type UnderwritingRuleCondition = {
  minMonthlyVolume?: number;
  maxMonthlyVolume?: number;
  minAverageTicket?: number;
  maxAverageTicket?: number;
  minProposedRate?: number;
  minDocumentCompletionRate?: number;
  maxDocumentCompletionRate?: number;
  riskKeywords?: string[];
};

export type UnderwritingEvaluationInput = {
  record: MerchantOnboardingRecord;
  steps: MerchantOnboardingStep[];
  proposedRate?: number | null;
  rules: UnderwritingRule[];
};

export type UnderwritingEvaluationResult = {
  decision: UnderwritingDecisionStatus;
  outcome: UnderwritingOutcome;
  triggeredRules: UnderwritingRule[];
  reasons: string[];
  documentCompletionRate: number;
};

export const defaultUnderwritingRules: Pick<UnderwritingRule, "name" | "outcome" | "enabled" | "priority" | "conditions">[] = [
  {
    name: "Deny risk flagged applications",
    outcome: "deny",
    enabled: true,
    priority: 10,
    conditions: { riskKeywords: ["match list", "terminated merchant file", "fraud"] },
  },
  {
    name: "Approve complete standard applications",
    outcome: "approve",
    enabled: true,
    priority: 100,
    conditions: { minMonthlyVolume: 10000, minDocumentCompletionRate: 0.8, minProposedRate: 1.5 },
  },
  {
    name: "Manual review incomplete document packets",
    outcome: "manual_review",
    enabled: true,
    priority: 200,
    conditions: { maxDocumentCompletionRate: 0.79 },
  },
];

export function validateUnderwritingRule(rule: Pick<UnderwritingRule, "name" | "outcome" | "priority" | "conditions">) {
  const conditions = normalizeConditions(rule.conditions);
  if (!rule.name.trim()) return "Rule name is required.";
  if (!["approve", "deny", "manual_review"].includes(rule.outcome)) return "Choose a supported underwriting outcome.";
  if (!Number.isFinite(rule.priority) || rule.priority < 1 || rule.priority > 999) return "Priority must be between 1 and 999.";
  if (Object.keys(conditions).length === 0) return "Add at least one condition.";
  if (conditions.minDocumentCompletionRate !== undefined && (conditions.minDocumentCompletionRate < 0 || conditions.minDocumentCompletionRate > 1)) {
    return "Minimum document completion rate must be between 0 and 1.";
  }
  if (conditions.maxDocumentCompletionRate !== undefined && (conditions.maxDocumentCompletionRate < 0 || conditions.maxDocumentCompletionRate > 1)) {
    return "Maximum document completion rate must be between 0 and 1.";
  }
  return null;
}

export function evaluateUnderwritingDecision(input: UnderwritingEvaluationInput): UnderwritingEvaluationResult {
  const documentCompletionRate = calculateDocumentCompletionRate(input.steps);
  const activeRules = input.rules.filter((rule) => rule.enabled).sort((a, b) => a.priority - b.priority);
  const triggeredRules = activeRules.filter((rule) =>
    conditionsMatch(normalizeConditions(rule.conditions), {
      record: input.record,
      documentCompletionRate,
      proposedRate: input.proposedRate ?? null,
    }),
  );
  const decisiveRule =
    triggeredRules.find((rule) => rule.outcome === "deny") ??
    triggeredRules.find((rule) => rule.outcome === "approve") ??
    triggeredRules.find((rule) => rule.outcome === "manual_review") ??
    null;
  const outcome = decisiveRule?.outcome ?? "manual_review";

  return {
    outcome,
    decision: mapOutcomeToDecision(outcome),
    triggeredRules,
    reasons: triggeredRules.length
      ? triggeredRules.map((rule) => `${rule.name}: ${summarizeConditions(rule.conditions)}`)
      : ["No automatic rule matched; manual review is required."],
    documentCompletionRate,
  };
}

export async function evaluateAndPersistUnderwritingDecision(
  supabase: SupabaseClient,
  actor: Pick<Profile, "id" | "full_name">,
  onboardingId: string,
) {
  const { data: record, error: recordError } = await supabase
    .from("merchant_onboarding_records")
    .select("*")
    .eq("id", onboardingId)
    .single<MerchantOnboardingRecord>();
  if (recordError || !record) throw recordError ?? new Error("Merchant onboarding record was not found.");

  const [stepsResult, rulesResult, dealResult] = await Promise.all([
    supabase.from("merchant_onboarding_steps").select("*").eq("onboarding_id", onboardingId).order("step_order").returns<MerchantOnboardingStep[]>(),
    supabase.from("underwriting_rules").select("*").eq("enabled", true).order("priority").returns<UnderwritingRule[]>(),
    record.merchant_id
      ? supabase.from("deals").select("proposed_rate").eq("merchant_id", record.merchant_id).maybeSingle<{ proposed_rate: number }>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (stepsResult.error) throw stepsResult.error;
  if (rulesResult.error) throw rulesResult.error;
  if (dealResult.error) throw dealResult.error;

  const result = evaluateUnderwritingDecision({
    record,
    steps: stepsResult.data ?? [],
    rules: (rulesResult.data?.length ? rulesResult.data : defaultUnderwritingRules.map((rule, index) => ({
      ...rule,
      id: `default-${index}`,
      created_by: null,
      updated_by: null,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    }))) as UnderwritingRule[],
    proposedRate: dealResult.data?.proposed_rate ?? null,
  });

  const status = result.decision === "approved" ? "approved" : result.decision === "declined" ? "declined" : "under_review";
  await supabase.from("merchant_onboarding_records").update({ status }).eq("id", record.id);
  if (record.merchant_id) {
    const merchantStatus = result.decision === "approved" ? "approved" : result.decision === "declined" ? "lost" : "underwriting";
    await supabase.from("merchants").update({ status: merchantStatus }).eq("id", record.merchant_id);
    await supabase.from("deals").update({ stage: merchantStatus }).eq("merchant_id", record.merchant_id);
  }

  const { data: decision } = await supabase
    .from("underwriting_decisions")
    .insert({
      merchant_onboarding_id: record.id,
      merchant_id: record.merchant_id,
      decision: result.decision,
      triggered_rule_ids: result.triggeredRules.filter((rule) => isUuid(rule.id)).map((rule) => rule.id),
      reasons: {
        reasons: result.reasons,
        document_completion_rate: result.documentCompletionRate,
      },
      evaluated_by: actor.id,
    })
    .select("id")
    .single<{ id: string }>();

  await writeAuditLog(supabase, actor, {
    action: "underwriting.auto_decision",
    entityType: "merchant_onboarding_record",
    entityId: record.id,
    summary: `${actor.full_name} ran underwriting and routed ${record.business_name} to ${result.decision}.`,
    metadata: {
      decision: result.decision,
      triggered_rules: result.triggeredRules.map((rule) => rule.name),
      decision_id: decision?.id ?? null,
    },
  });

  return { record, result, decisionId: decision?.id ?? null };
}

function normalizeConditions(conditions: Record<string, unknown>): UnderwritingRuleCondition {
  return conditions as UnderwritingRuleCondition;
}

function calculateDocumentCompletionRate(steps: MerchantOnboardingStep[]) {
  if (!steps.length) return 0;
  return steps.filter((step) => step.completed_at).length / steps.length;
}

function conditionsMatch(
  conditions: UnderwritingRuleCondition,
  context: { record: MerchantOnboardingRecord; documentCompletionRate: number; proposedRate: number | null },
) {
  if (conditions.minMonthlyVolume !== undefined && context.record.monthly_volume_estimate < conditions.minMonthlyVolume) return false;
  if (conditions.maxMonthlyVolume !== undefined && context.record.monthly_volume_estimate > conditions.maxMonthlyVolume) return false;
  if (conditions.minAverageTicket !== undefined && context.record.average_ticket < conditions.minAverageTicket) return false;
  if (conditions.maxAverageTicket !== undefined && context.record.average_ticket > conditions.maxAverageTicket) return false;
  if (conditions.minProposedRate !== undefined && (context.proposedRate ?? 0) < conditions.minProposedRate) return false;
  if (conditions.minDocumentCompletionRate !== undefined && context.documentCompletionRate < conditions.minDocumentCompletionRate) return false;
  if (conditions.maxDocumentCompletionRate !== undefined && context.documentCompletionRate > conditions.maxDocumentCompletionRate) return false;

  if (conditions.riskKeywords?.length) {
    const haystack = `${context.record.notes ?? ""} ${context.record.processing_needs ?? ""} ${context.record.current_processor ?? ""}`.toLowerCase();
    return conditions.riskKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  }

  return true;
}

function mapOutcomeToDecision(outcome: UnderwritingOutcome): UnderwritingDecisionStatus {
  if (outcome === "approve") return "approved";
  if (outcome === "deny") return "declined";
  return "manual_review";
}

function summarizeConditions(conditions: Record<string, unknown>) {
  return Object.entries(conditions)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("|") : String(value)}`)
    .join(", ");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
