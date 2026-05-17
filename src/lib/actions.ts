"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { writeAgentActivity } from "@/lib/activity";
import { writeAuditLog } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { brand } from "@/lib/branding";
import { getCrmData } from "@/lib/data";
import { buildExportAuditSummary, generateFinancialExport } from "@/lib/finance-export";
import {
  generatePayrollExport,
  payrollProviders,
  sealPayrollCredentials,
  syncPayrollIntegration,
  testPayrollIntegration,
} from "@/lib/payroll";
import { enterpriseSettingDefaults, permissionCatalog } from "@/lib/permissions";
import {
  buildProcessorPricingAuditMetadata,
  calculateResidualBreakdown,
  normalizeProcessorKey,
  recalculateResidualRow,
  shouldProtectResidualFromRecalculation,
} from "@/lib/processor-pricing";
import { normalizeImportMonth, parseProcessorResidualCsv } from "@/lib/residual-import";
import { createSignatureProviderRequest } from "@/lib/signature-service";
import { isIntegrationEncryptionConfigured } from "@/lib/secret-vault";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAssignRecruitToTeam, defaultTeamRecruitLimit, progressForRecruitStatus } from "@/lib/team-management";
import {
  evaluateAndPersistUnderwritingDecision,
  validateUnderwritingRule,
} from "@/lib/underwriting";
import {
  applyOpportunityStageAutomation,
  updateOpportunityStage,
} from "@/lib/workflow-automation";
import type {
  AgentOnboardingRecord,
  AgentOnboardingStep,
  AgentRecruit,
  AgentRecruitUpdate,
  Document,
  ExportFormat,
  Merchant,
  MerchantOnboardingRecord,
  MerchantOnboardingStatus,
  MerchantOnboardingStep,
  MerchantStatus,
  PayrollProviderId,
  ProcessorPricingSetting,
  ProcessorPricingUnit,
  RecruitStatus,
  Role,
  RolePermission,
  SignatureEntityType,
  SignatureRequest,
  SignatureStatus,
  Task,
  TaskStatus,
} from "@/lib/types";
import { agentOnboardingStepTemplates, merchantOnboardingStepTemplates } from "@/lib/workflow-constants";

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

const nullableString = z.preprocess((value) => (value === "" ? null : value), z.string().nullable().optional());

const RecruitStatusInput = z.enum([
  "new_lead",
  "contacted",
  "interested",
  "application_started",
  "onboarding",
  "active",
  "rejected",
]);

const AgentOnboardingStatusInput = z.enum([
  "invited",
  "profile_incomplete",
  "training",
  "documents_pending",
  "under_review",
  "approved",
  "active",
]);

const MerchantOnboardingStatusInput = z.enum([
  "lead",
  "contacted",
  "application_started",
  "documents_needed",
  "under_review",
  "approved",
  "active",
  "declined",
]);

const SignatureStatusInput = z.enum(["draft", "sent", "viewed", "signed", "declined", "expired"]);
const SignatureEntityTypeInput = z.enum(["agent", "recruit", "merchant", "account"]);

const CreateRecruitInput = z.object({
  full_name: z.string().trim().min(1),
  email: z.string().trim().email().or(z.literal("")),
  phone: z.string().trim().optional(),
  source: z.string().trim().optional(),
  status: RecruitStatusInput.default("new_lead"),
  assigned_recruiter_id: nullableString,
  follow_up_at: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const RecruitUpdateInput = z.object({
  recruit_id: z.string().uuid(),
  status: RecruitStatusInput.optional(),
  note: z.string().trim().min(1),
  follow_up_at: z.string().trim().optional(),
});

const CreateAgentOnboardingInput = z.object({
  profile_id: nullableString,
  recruit_id: nullableString,
  full_name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  assigned_admin_id: nullableString,
  status: AgentOnboardingStatusInput.default("invited"),
});

const UpdateAgentOnboardingStatusInput = z.object({
  onboarding_id: z.string().uuid(),
  status: AgentOnboardingStatusInput,
  training_progress: z.coerce.number().min(0).max(100).optional(),
});

const UpdateOnboardingStepInput = z.object({
  step_id: z.string().uuid(),
  completed: z.boolean(),
});

const CreateMerchantOnboardingInput = z.object({
  business_name: z.string().trim().min(1),
  contact_name: z.string().trim().min(1),
  contact_email: z.string().trim().email().or(z.literal("")),
  contact_phone: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  processing_needs: z.string().trim().optional(),
  monthly_volume_estimate: z.coerce.number().nonnegative(),
  average_ticket: z.coerce.number().nonnegative(),
  current_processor: z.string().trim().optional(),
  proposed_rate: z.coerce.number().nonnegative().default(1.65),
  status: MerchantOnboardingStatusInput.default("lead"),
  assigned_agent_id: nullableString,
  follow_up_at: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const UpdateMerchantOnboardingStatusInput = z.object({
  onboarding_id: z.string().uuid(),
  status: MerchantOnboardingStatusInput,
  follow_up_at: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

const CreateSignatureRequestInput = z.object({
  title: z.string().trim().min(1),
  recipient_name: z.string().trim().min(1),
  recipient_email: z.string().trim().email(),
  recipient_profile_id: nullableString,
  related_entity_type: SignatureEntityTypeInput,
  related_entity_id: nullableString,
  document_id: nullableString,
  send_now: z.boolean().default(true),
});

const UpdateSignatureRequestStatusInput = z.object({
  signature_request_id: z.string().uuid(),
  status: SignatureStatusInput,
});

const CreateTeamMemberInput = z.object({
  full_name: z.string().trim().min(1),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  phone: z.string().trim().optional(),
  role: z.enum(["admin", "manager", "agent"]),
  status: z.enum(["active", "invited", "inactive"]).default("active"),
  manager_id: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
  agent_code: z.string().trim().optional(),
  sponsor_agent_id: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
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

const RolePermissionUpdateInput = z.object({
  role: z.enum(["admin", "manager", "agent"]),
  permissions: z.array(
    z.object({
      permission_key: z.string(),
      enabled: z.boolean(),
    }),
  ),
});

const EnterpriseSettingsInput = z.object({
  settings: z.array(
    z.object({
      setting_key: z.string(),
      setting_value: z.record(z.string(), z.unknown()),
      description: z.string().optional(),
    }),
  ),
});

const ExportFormatInput = z.enum(["csv", "xlsx"]);

const ExportFiltersInput = z.object({
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  teamId: z.string().trim().optional(),
  agentId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  processor: z.string().trim().optional(),
});

const FinancialExportInput = ExportFiltersInput.extend({
  format: ExportFormatInput.default("csv"),
});

const PayrollExportInput = ExportFiltersInput.extend({
  format: ExportFormatInput.default("csv"),
  provider: z.enum(["stripe", "gusto", "manual"]).optional(),
});

const PayrollIntegrationInput = z.object({
  provider: z.enum(["stripe", "gusto", "manual"]),
  display_name: z.string().trim().min(2).max(120),
  account_identifier: z.string().trim().min(2).max(120),
  credentials: z.record(z.string(), z.string().trim()).default({}),
});

const PayrollIntegrationIdInput = z.object({
  integration_id: z.string().uuid(),
});

const ProcessorPricingInput = z.object({
  id: z.string().uuid().optional(),
  processor_name: z.string().trim().min(2).max(120),
  pricing_unit: z.enum(["basis_points", "percentage", "flat_fee", "basis_points_plus_flat", "percentage_plus_flat"]),
  rate_value: z.coerce.number().min(0).max(10000),
  flat_fee: z.coerce.number().min(0).optional().nullable(),
  effective_at: z.string().trim().min(1),
  is_active: z.boolean().default(true),
  notes: z.string().trim().optional(),
});

const ProcessorPricingRecalculationInput = z.object({
  includeDeals: z.boolean().default(true),
  includeResiduals: z.boolean().default(false),
  includeLockedResiduals: z.boolean().default(false),
});

const AssignRecruitToTeamInput = z.object({
  recruit_id: z.string().uuid(),
  team_id: z.string().uuid(),
  note: z.string().trim().optional(),
});

const RecruitProgressInput = z.object({
  recruit_id: z.string().uuid(),
  team_id: z.string().uuid().nullable().optional(),
  status: RecruitStatusInput,
  progress_percent: z.coerce.number().min(0).max(100).optional(),
  note: z.string().trim().optional(),
});

const UnderwritingConditionInput = z.object({
  minMonthlyVolume: z.coerce.number().nonnegative().optional(),
  maxMonthlyVolume: z.coerce.number().nonnegative().optional(),
  minAverageTicket: z.coerce.number().nonnegative().optional(),
  maxAverageTicket: z.coerce.number().nonnegative().optional(),
  minProposedRate: z.coerce.number().nonnegative().optional(),
  maxProposedRate: z.coerce.number().nonnegative().optional(),
  minDocumentCompletionRate: z.coerce.number().min(0).max(1).optional(),
  maxDocumentCompletionRate: z.coerce.number().min(0).max(1).optional(),
  riskKeywords: z.array(z.string().trim().min(1)).optional(),
});

const UnderwritingRuleInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  outcome: z.enum(["approve", "deny", "manual_review"]),
  enabled: z.boolean(),
  priority: z.coerce.number().int().min(1).max(999),
  conditions: UnderwritingConditionInput,
});

const UnderwritingRulesInput = z.object({
  rules: z.array(UnderwritingRuleInput).min(1),
  deletedRuleIds: z.array(z.string().uuid()).default([]),
  autoDecisionsEnabled: z.boolean().optional(),
});

const UnderwritingRunInput = z.object({
  onboarding_id: z.string().uuid().optional(),
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

  const [processorPricingSettings, compensationRule] = await Promise.all([
    loadProcessorPricingSettings(supabase),
    loadCompensationRule(supabase),
  ]);
  const residualEstimate = calculateResidualBreakdown({
    processingVolume: parsed.data.monthly_volume_estimate,
    proposedRatePercent: parsed.data.proposed_rate,
    processorName: parsed.data.current_processor,
    pricingSettings: processorPricingSettings,
    compensationRule,
  });

  const { error: dealError } = await supabase.from("deals").insert({
    merchant_id: merchant.id,
    agent_id: assignedAgentId,
    stage: parsed.data.status,
    proposed_rate: parsed.data.proposed_rate,
    estimated_monthly_volume: parsed.data.monthly_volume_estimate,
    estimated_residual: residualEstimate.netResidual,
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
    metadata: {
      assigned_agent_id: assignedAgentId,
      status: parsed.data.status,
      processor_pricing: residualEstimate.pricingSnapshot,
    },
  });

  revalidatePath("/dashboard");
  return { ok: true, message: `${parsed.data.business_name} was created.`, data: merchant };
}

export async function updateMerchantStatusAction(merchantId: string, status: MerchantStatus): Promise<ActionResult> {
  const { supabase, profile } = await getSessionContext();
  const transition = await updateOpportunityStage(supabase, profile, {
    merchantId,
    newStage: status,
    reason: "Manual pipeline stage update.",
    triggerEvent: "manual_stage_update",
    automatic: false,
    metadata: { status },
  });

  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  revalidatePath(`/merchants/${merchantId}`);
  return { ok: true, message: transition ? "Merchant stage updated." : "Merchant was already in that stage." };
}

export async function deleteMerchantAction(merchantId: string): Promise<ActionResult> {
  if (!merchantId) {
    return { ok: false, message: "Choose a merchant to delete." };
  }

  const { supabase, profile } = await getSessionContext();

  if (profile.role === "agent") {
    return { ok: false, message: "Only managers and admins can delete merchants." };
  }

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", merchantId)
    .maybeSingle<Merchant>();

  if (merchantError) {
    return { ok: false, message: merchantError.message };
  }

  if (!merchant) {
    return { ok: false, message: "Merchant was not found or is outside your book." };
  }

  const adminSupabase = createAdminClient();
  const { data: documents, error: documentsError } = await adminSupabase
    .from("documents")
    .select("*")
    .eq("merchant_id", merchantId)
    .returns<Document[]>();

  if (documentsError) {
    return { ok: false, message: documentsError.message };
  }

  const storagePaths = (documents ?? [])
    .map((document) => document.file_url)
    .filter((fileUrl) => fileUrl && !fileUrl.startsWith("http") && !fileUrl.startsWith("/"));

  if (storagePaths.length) {
    const { error: storageError } = await adminSupabase.storage.from("merchant-documents").remove(storagePaths);
    if (storageError) {
      return { ok: false, message: `Merchant files could not be removed: ${storageError.message}` };
    }
  }

  const { count: updateCount } = await adminSupabase
    .from("merchant_updates")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId);
  const { count: taskCount } = await adminSupabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId);
  const { count: residualCount } = await adminSupabase
    .from("residuals")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId);

  const { error: deleteError } = await adminSupabase.from("merchants").delete().eq("id", merchantId);

  if (deleteError) {
    return { ok: false, message: deleteError.message };
  }

  await writeAuditLog(supabase, profile, {
    action: "merchant.delete",
    entityType: "merchant",
    entityId: merchantId,
    summary: `${profile.full_name} deleted merchant ${merchant.business_name}.`,
    metadata: {
      business_name: merchant.business_name,
      assigned_agent_id: merchant.assigned_agent_id,
      documents_removed: storagePaths.length,
      document_records_removed: documents?.length ?? 0,
      updates_removed: updateCount ?? 0,
      tasks_removed: taskCount ?? 0,
      residuals_removed: residualCount ?? 0,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/merchants");
  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath("/documents");
  revalidatePath("/opportunities");
  revalidatePath("/reports");
  revalidatePath("/tasks");
  return { ok: true, message: `${merchant.business_name} was deleted.` };
}

export async function createRecruitAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateRecruitInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Complete the required recruit fields." };
  }

  const { supabase, profile } = await getSessionContext();
  const assignedRecruiterId = parsed.data.assigned_recruiter_id || profile.id;
  const followUpAt = toIsoOrNull(parsed.data.follow_up_at);

  const { data, error } = await supabase
    .from("agent_recruits")
    .insert({
      full_name: parsed.data.full_name,
      email: parsed.data.email || "",
      phone: parsed.data.phone || null,
      source: parsed.data.source || null,
      status: parsed.data.status,
      assigned_recruiter_id: assignedRecruiterId,
      created_by: profile.id,
      follow_up_at: followUpAt,
      notes: parsed.data.notes || null,
    })
    .select("*")
    .single<AgentRecruit>();

  if (error) return { ok: false, message: error.message };

  await supabase.from("agent_recruit_updates").insert({
    recruit_id: data.id,
    author_profile_id: profile.id,
    status: parsed.data.status,
    note: parsed.data.notes || "Recruit added to the pipeline.",
    follow_up_at: followUpAt,
  });

  if (followUpAt) {
    await createFollowUpTask(supabase, assignedRecruiterId, {
      title: `Follow up with recruit ${parsed.data.full_name}`,
      description: parsed.data.notes || "Recruiting follow-up",
      dueDate: followUpAt,
    });
  }

  await writeAuditLog(supabase, profile, {
    action: "recruit.create",
    entityType: "agent_recruit",
    entityId: data.id,
    summary: `${profile.full_name} added recruit ${parsed.data.full_name}.`,
    metadata: { status: parsed.data.status, source: parsed.data.source || null },
  });

  revalidateWorkflowPaths();
  return { ok: true, message: `${parsed.data.full_name} was added to recruiting.`, data };
}

export async function addRecruitUpdateAction(input: unknown): Promise<ActionResult> {
  const parsed = RecruitUpdateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Add a recruit note before saving." };
  }

  const { supabase, profile } = await getSessionContext();
  const followUpAt = toIsoOrNull(parsed.data.follow_up_at);

  const { data, error } = await supabase
    .from("agent_recruit_updates")
    .insert({
      recruit_id: parsed.data.recruit_id,
      author_profile_id: profile.id,
      status: parsed.data.status || null,
      note: parsed.data.note,
      follow_up_at: followUpAt,
    })
    .select("*")
    .single<AgentRecruitUpdate>();

  if (error) return { ok: false, message: error.message };

  const recruitUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status) recruitUpdate.status = parsed.data.status;
  if (followUpAt) recruitUpdate.follow_up_at = followUpAt;

  const { data: recruit } = await supabase
    .from("agent_recruits")
    .update(recruitUpdate)
    .eq("id", parsed.data.recruit_id)
    .select("id,full_name,assigned_recruiter_id")
    .maybeSingle<{ id: string; full_name: string; assigned_recruiter_id: string | null }>();

  if (followUpAt && recruit?.assigned_recruiter_id) {
    await createFollowUpTask(supabase, recruit.assigned_recruiter_id, {
      title: `Follow up with recruit ${recruit.full_name}`,
      description: parsed.data.note,
      dueDate: followUpAt,
    });
  }

  await writeAuditLog(supabase, profile, {
    action: "recruit.update",
    entityType: "agent_recruit",
    entityId: parsed.data.recruit_id,
    summary: `${profile.full_name} updated a recruit timeline.`,
    metadata: { status: parsed.data.status || null, follow_up_at: followUpAt },
  });

  revalidateWorkflowPaths();
  return { ok: true, message: "Recruit timeline updated.", data };
}

export async function createAgentOnboardingAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateAgentOnboardingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Complete the required onboarding fields." };
  }

  const { supabase, profile } = await getSessionContext();
  const { data, error } = await supabase
    .from("agent_onboarding_records")
    .insert({
      profile_id: parsed.data.profile_id || null,
      recruit_id: parsed.data.recruit_id || null,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      assigned_admin_id: parsed.data.assigned_admin_id || profile.id,
      status: parsed.data.status,
    })
    .select("*")
    .single<AgentOnboardingRecord>();

  if (error) return { ok: false, message: error.message };

  const stepRows = agentOnboardingStepTemplates.map((title, index) => ({
    onboarding_id: data.id,
    title,
    description: null,
    step_order: index + 1,
  }));
  const { error: stepsError } = await supabase.from("agent_onboarding_steps").insert(stepRows);
  if (stepsError) return { ok: false, message: stepsError.message };

  if (parsed.data.recruit_id) {
    await supabase.from("agent_recruits").update({ status: "onboarding" }).eq("id", parsed.data.recruit_id);
  }

  await writeAuditLog(supabase, profile, {
    action: "agent_onboarding.create",
    entityType: "agent_onboarding_record",
    entityId: data.id,
    summary: `${profile.full_name} started onboarding for ${parsed.data.full_name}.`,
    metadata: { status: parsed.data.status, recruit_id: parsed.data.recruit_id || null },
  });

  revalidateWorkflowPaths();
  return { ok: true, message: `${parsed.data.full_name} onboarding was created.`, data };
}

export async function updateAgentOnboardingStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateAgentOnboardingStatusInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid onboarding status." };
  }

  const { supabase, profile } = await getSessionContext();
  const status = parsed.data.status;
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    profile_complete: !["invited", "profile_incomplete"].includes(status),
    documents_signed: !["invited", "profile_incomplete", "training", "documents_pending"].includes(status),
    account_activated: status === "active",
  };

  if (parsed.data.training_progress !== undefined) {
    patch.training_progress = parsed.data.training_progress;
  }
  if (status === "approved" || status === "active") {
    patch.admin_approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("agent_onboarding_records")
    .update(patch)
    .eq("id", parsed.data.onboarding_id)
    .select("*")
    .single<AgentOnboardingRecord>();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "agent_onboarding.status_update",
    entityType: "agent_onboarding_record",
    entityId: data.id,
    summary: `${profile.full_name} moved agent onboarding to ${status}.`,
    metadata: { status },
  });

  revalidateWorkflowPaths();
  return { ok: true, message: "Agent onboarding updated.", data };
}

export async function updateAgentOnboardingStepAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateOnboardingStepInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid onboarding step." };
  }

  const { supabase, profile } = await getSessionContext();
  const { data: step, error } = await supabase
    .from("agent_onboarding_steps")
    .update({ completed_at: parsed.data.completed ? new Date().toISOString() : null })
    .eq("id", parsed.data.step_id)
    .select("*")
    .single<AgentOnboardingStep>();

  if (error) return { ok: false, message: error.message };

  await refreshAgentOnboardingProgress(supabase, step.onboarding_id);
  await writeAuditLog(supabase, profile, {
    action: "agent_onboarding.step_update",
    entityType: "agent_onboarding_record",
    entityId: step.onboarding_id,
    summary: `${profile.full_name} ${parsed.data.completed ? "completed" : "reopened"} ${step.title}.`,
    metadata: { step_id: step.id, completed: parsed.data.completed },
  });

  revalidateWorkflowPaths();
  return { ok: true, message: "Checklist updated.", data: step };
}

export async function createMerchantOnboardingAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateMerchantOnboardingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Complete the required merchant onboarding fields." };
  }

  const { supabase, profile } = await getSessionContext();
  const currentAgentId = await getCurrentAgentId(supabase, profile.id);
  const assignedAgentId = profile.role === "agent" ? currentAgentId : parsed.data.assigned_agent_id || currentAgentId;

  if (!assignedAgentId) {
    return { ok: false, message: "No agent record is available for merchant onboarding." };
  }

  const merchantStatus = mapMerchantOnboardingStatus(parsed.data.status);
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .insert({
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
      status: merchantStatus,
      assigned_agent_id: assignedAgentId,
      notes: parsed.data.notes || null,
      processing_start_date: parsed.data.status === "active" ? new Date().toISOString().slice(0, 10) : null,
      is_verified: parsed.data.status === "active",
    })
    .select("*")
    .single<Merchant>();

  if (merchantError) return { ok: false, message: merchantError.message };

  const [processorPricingSettings, compensationRule] = await Promise.all([
    loadProcessorPricingSettings(supabase),
    loadCompensationRule(supabase),
  ]);
  const residualEstimate = calculateResidualBreakdown({
    processingVolume: parsed.data.monthly_volume_estimate,
    proposedRatePercent: parsed.data.proposed_rate,
    processorName: parsed.data.current_processor,
    pricingSettings: processorPricingSettings,
    compensationRule,
  });
  const { error: dealError } = await supabase.from("deals").insert({
    merchant_id: merchant.id,
    agent_id: assignedAgentId,
    stage: merchantStatus,
    proposed_rate: parsed.data.proposed_rate,
    estimated_monthly_volume: parsed.data.monthly_volume_estimate,
    estimated_residual: residualEstimate.netResidual,
    close_probability: parsed.data.status === "active" ? 100 : 35,
  });

  if (dealError) return { ok: false, message: dealError.message };

  const followUpAt = toIsoOrNull(parsed.data.follow_up_at);
  const { data, error } = await supabase
    .from("merchant_onboarding_records")
    .insert({
      merchant_id: merchant.id,
      business_name: parsed.data.business_name,
      contact_name: parsed.data.contact_name,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      industry: parsed.data.industry || null,
      processing_needs: parsed.data.processing_needs || null,
      monthly_volume_estimate: parsed.data.monthly_volume_estimate,
      average_ticket: parsed.data.average_ticket,
      current_processor: parsed.data.current_processor || null,
      status: parsed.data.status,
      assigned_agent_id: assignedAgentId,
      follow_up_at: followUpAt,
      notes: parsed.data.notes || null,
    })
    .select("*")
    .single<MerchantOnboardingRecord>();

  if (error) return { ok: false, message: error.message };

  const stepRows = merchantOnboardingStepTemplates.map((title, index) => ({
    onboarding_id: data.id,
    title,
    description: null,
    step_order: index + 1,
  }));
  const { error: stepsError } = await supabase.from("merchant_onboarding_steps").insert(stepRows);
  if (stepsError) return { ok: false, message: stepsError.message };

  if (followUpAt) {
    const assignedProfileId = await profileIdForAgent(supabase, assignedAgentId);
    if (assignedProfileId) {
      await createFollowUpTask(supabase, assignedProfileId, {
        title: `Follow up with ${parsed.data.business_name}`,
        description: parsed.data.notes || parsed.data.processing_needs || "Merchant onboarding follow-up",
        dueDate: followUpAt,
        merchantId: merchant.id,
      });
    }
  }

  await writeAuditLog(supabase, profile, {
    action: "merchant_onboarding.create",
    entityType: "merchant_onboarding_record",
    entityId: data.id,
    summary: `${profile.full_name} started merchant onboarding for ${parsed.data.business_name}.`,
    metadata: { merchant_id: merchant.id, status: parsed.data.status, processor_pricing: residualEstimate.pricingSnapshot },
  });

  revalidateWorkflowPaths();
  return { ok: true, message: `${parsed.data.business_name} onboarding was created.`, data };
}

export async function updateMerchantOnboardingStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateMerchantOnboardingStatusInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid merchant onboarding status." };
  }

  const { supabase, profile } = await getSessionContext();
  const followUpAt = toIsoOrNull(parsed.data.follow_up_at);
  const patch: Record<string, unknown> = {
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  };
  if (followUpAt) patch.follow_up_at = followUpAt;

  const { data, error } = await supabase
    .from("merchant_onboarding_records")
    .update(patch)
    .eq("id", parsed.data.onboarding_id)
    .select("*")
    .single<MerchantOnboardingRecord>();

  if (error) return { ok: false, message: error.message };

  const stageTransition = await applyOpportunityStageAutomation(supabase, profile, data.merchant_id, {
    type: "merchant_onboarding_status_changed",
    onboardingId: data.id,
    onboardingStatus: parsed.data.status,
    source: "merchant_onboarding",
  });

  if (followUpAt && data.assigned_agent_id) {
    const assignedProfileId = await profileIdForAgent(supabase, data.assigned_agent_id);
    if (assignedProfileId) {
      await createFollowUpTask(supabase, assignedProfileId, {
        title: `Follow up with ${data.business_name}`,
        description: parsed.data.note || "Merchant onboarding follow-up",
        dueDate: followUpAt,
        merchantId: data.merchant_id,
      });
    }
  }

  await writeAuditLog(supabase, profile, {
    action: "merchant_onboarding.status_update",
    entityType: "merchant_onboarding_record",
    entityId: data.id,
    summary: `${profile.full_name} moved merchant onboarding to ${parsed.data.status}.`,
    metadata: { status: parsed.data.status, merchant_id: data.merchant_id },
  });

  if (parsed.data.status === "under_review") {
    const { data: setting } = await supabase
      .from("enterprise_settings")
      .select("setting_value")
      .eq("setting_key", "underwriting_auto_decisions_enabled")
      .maybeSingle<{ setting_value: { enabled?: boolean } }>();

    if (setting?.setting_value?.enabled !== false) {
      try {
        const decision = await evaluateAndPersistUnderwritingDecision(supabase, profile, data.id);
        revalidateWorkflowPaths();
        return {
          ok: true,
          message: `Merchant onboarding updated. Underwriting routed this application to ${decision.result.decision}.`,
          data: decision,
        };
      } catch (error) {
        await writeAgentActivity(supabase, {
          profileId: profile.id,
          actorProfileId: profile.id,
          eventType: "underwriting.auto_decision.failed",
          eventSource: "underwriting",
          severity: "warning",
          summary: error instanceof Error ? error.message : "Underwriting auto-decision failed.",
          metadata: { onboarding_id: data.id },
        });
      }
    }
  }

  revalidateWorkflowPaths();
  return {
    ok: true,
    message: stageTransition
      ? `Merchant onboarding updated. Pipeline moved to ${stageTransition.newStage}.`
      : "Merchant onboarding updated.",
    data,
  };
}

export async function updateMerchantOnboardingStepAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateOnboardingStepInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid onboarding step." };
  }

  const { supabase, profile } = await getSessionContext();
  const { data, error } = await supabase
    .from("merchant_onboarding_steps")
    .update({ completed_at: parsed.data.completed ? new Date().toISOString() : null })
    .eq("id", parsed.data.step_id)
    .select("*")
    .single<MerchantOnboardingStep>();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "merchant_onboarding.step_update",
    entityType: "merchant_onboarding_record",
    entityId: data.onboarding_id,
    summary: `${profile.full_name} ${parsed.data.completed ? "completed" : "reopened"} ${data.title}.`,
    metadata: { step_id: data.id, completed: parsed.data.completed },
  });

  revalidateWorkflowPaths();
  return { ok: true, message: "Merchant checklist updated.", data };
}

export async function createSignatureRequestAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateSignatureRequestInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Complete the signature request fields." };
  }

  const { supabase, profile } = await getSessionContext();
  const providerResponse = parsed.data.send_now
    ? await createSignatureProviderRequest({
        title: parsed.data.title,
        recipientName: parsed.data.recipient_name,
        recipientEmail: parsed.data.recipient_email,
        relatedEntityType: parsed.data.related_entity_type as SignatureEntityType,
        relatedEntityId: parsed.data.related_entity_id || null,
        documentId: parsed.data.document_id || null,
      })
    : null;
  const status: SignatureStatus = parsed.data.send_now ? "sent" : "draft";

  const { data, error } = await supabase
    .from("signature_requests")
    .insert({
      title: parsed.data.title,
      recipient_name: parsed.data.recipient_name,
      recipient_email: parsed.data.recipient_email,
      recipient_profile_id: parsed.data.recipient_profile_id || null,
      related_entity_type: parsed.data.related_entity_type,
      related_entity_id: parsed.data.related_entity_id || null,
      document_id: parsed.data.document_id || null,
      provider: providerResponse?.provider ?? "manual",
      provider_request_id: providerResponse?.providerRequestId ?? null,
      signing_url: providerResponse?.signingUrl ?? null,
      status,
      metadata: {},
      created_by: profile.id,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .select("*")
    .single<SignatureRequest>();

  if (error) return { ok: false, message: error.message };

  if (parsed.data.recipient_profile_id) {
    await supabase.from("notifications").insert({
      profile_id: parsed.data.recipient_profile_id,
      title: "Signature requested",
      body: `${profile.full_name} sent ${parsed.data.title} for signature.`,
      url: "/documents",
      dedupe_key: `signature-request:${data.id}`,
    });
  }

  await writeAuditLog(supabase, profile, {
    action: "signature_request.create",
    entityType: "signature_request",
    entityId: data.id,
    summary: `${profile.full_name} created signature request ${parsed.data.title}.`,
    metadata: { status, provider: data.provider, related_entity_type: parsed.data.related_entity_type },
  });

  const stageTransition =
    status === "sent" && data.related_entity_type === "merchant"
      ? await applyOpportunityStageAutomation(supabase, profile, data.related_entity_id, {
          type: "signature_request_sent",
          signatureRequestId: data.id,
          signatureStatus: status,
          relatedEntityType: data.related_entity_type,
          source: "signature_request",
        })
      : null;

  revalidateWorkflowPaths();
  return {
    ok: true,
    message: stageTransition
      ? `Signature request sent. Pipeline moved to ${stageTransition.newStage}.`
      : status === "sent"
        ? "Signature request sent."
        : "Signature draft saved.",
    data,
  };
}

export async function updateSignatureRequestStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateSignatureRequestStatusInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid signature status." };
  }

  const { supabase, profile } = await getSessionContext();
  const patch: Record<string, unknown> = {
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.status === "signed") patch.completed_at = new Date().toISOString();
  if (parsed.data.status === "sent") patch.sent_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("signature_requests")
    .update(patch)
    .eq("id", parsed.data.signature_request_id)
    .select("*")
    .single<SignatureRequest>();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "signature_request.status_update",
    entityType: "signature_request",
    entityId: data.id,
    summary: `${profile.full_name} marked ${data.title} as ${parsed.data.status}.`,
    metadata: { status: parsed.data.status },
  });

  const stageTransition =
    parsed.data.status === "sent" && data.related_entity_type === "merchant"
      ? await applyOpportunityStageAutomation(supabase, profile, data.related_entity_id, {
          type: "signature_request_sent",
          signatureRequestId: data.id,
          signatureStatus: parsed.data.status,
          relatedEntityType: data.related_entity_type,
          source: "signature_request",
        })
      : null;

  revalidateWorkflowPaths();
  return {
    ok: true,
    message: stageTransition ? `Signature status updated. Pipeline moved to ${stageTransition.newStage}.` : "Signature status updated.",
    data,
  };
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

  const { data: update, error } = await supabase
    .from("merchant_updates")
    .insert({
      merchant_id: merchantId,
      agent_id: currentAgent.id,
      update_type: updateType,
      note,
      next_follow_up_date: nextFollowUpDate || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "merchant.update_create",
    entityType: "merchant",
    entityId: merchantId,
    summary: `${profile.full_name} added a ${updateType} update.`,
    metadata: { update_type: updateType, next_follow_up_date: nextFollowUpDate || null },
  });

  const stageTransition = await applyOpportunityStageAutomation(supabase, profile, merchantId, {
    type: "merchant_update_logged",
    updateType,
    updateId: update?.id ?? null,
    source: "merchant_update",
  });

  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  revalidatePath(`/merchants/${merchantId}`);
  return {
    ok: true,
    message: stageTransition ? `Merchant update saved. Pipeline moved to ${stageTransition.newStage}.` : "Merchant update saved.",
  };
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

  revalidatePath("/dashboard");
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

  const { profile } = await getSessionContext();

  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can create users and agents." };
  }

  let adminSupabase: SupabaseClient;
  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Supabase admin client is not configured." };
  }

  const listed = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listed.error) {
    return { ok: false, message: listed.error.message };
  }

  let userId = listed.data.users.find((user) => user.email?.toLowerCase() === parsed.data.email)?.id;

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

  const profilePayload = {
    user_id: userId,
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    role: parsed.data.role,
    phone: parsed.data.phone || null,
    status: parsed.data.status,
    manager_id: parsed.data.manager_id || null,
  };
  const existingProfile = await findExistingProfile(adminSupabase, userId, parsed.data.email);
  const profileWrite = existingProfile
    ? adminSupabase.from("profiles").update(profilePayload).eq("id", existingProfile.id)
    : adminSupabase.from("profiles").insert(profilePayload);

  const { data: profileRow, error: profileError } = await profileWrite
    .select("*")
    .single<{ id: string }>();

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  if (parsed.data.role === "agent") {
    let teamAssignment: Awaited<ReturnType<typeof resolveTeamAssignment>>;
    try {
      teamAssignment = await resolveTeamAssignment(adminSupabase, parsed.data.sponsor_agent_id || null);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Unable to resolve team assignment." };
    }

    const agentCode =
      parsed.data.agent_code?.trim() ||
      `MD-${parsed.data.full_name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const { data: agentRow, error: agentError } = await adminSupabase
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
      const { error: memberError } = await adminSupabase.from("team_members").upsert(
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

  await writeAuditLog(adminSupabase, profile, {
    action: "user.upsert",
    entityType: "profile",
    entityId: profileRow.id,
    summary: `${profile.full_name} created or updated ${parsed.data.full_name}.`,
    metadata: { role: parsed.data.role, status: parsed.data.status, manager_id: parsed.data.manager_id || null },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
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

  revalidatePath("/dashboard");
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

  revalidatePath("/dashboard");
  return { ok: true, message: `Reassigned ${merchantIds.length} merchants.` };
}

export async function updateRolePermissionsAction(input: unknown): Promise<ActionResult> {
  const parsed = RolePermissionUpdateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a role and valid permissions to update." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can change role access." };
  }

  const validKeys = new Set<string>(permissionCatalog.map((permission) => permission.key));
  const criticalAdminKeys = new Set<string>(
    permissionCatalog.filter((permission) => permission.critical).map((permission) => permission.key),
  );
  const adminOnlyKeys = new Set<string>(
    permissionCatalog.filter((permission) => permission.adminOnly).map((permission) => permission.key),
  );
  const rows = parsed.data.permissions
    .filter((permission) => validKeys.has(permission.permission_key))
    .map((permission) => {
      const enabled =
        parsed.data.role === "admin" && criticalAdminKeys.has(permission.permission_key)
          ? true
          : parsed.data.role !== "admin" && adminOnlyKeys.has(permission.permission_key)
            ? false
            : permission.enabled;

      return {
        role: parsed.data.role as Role,
        permission_key: permission.permission_key,
        enabled,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      };
    });

  if (!rows.length) {
    return { ok: false, message: "No supported permissions were selected." };
  }

  const { data, error } = await supabase
    .from("role_permissions")
    .upsert(rows, { onConflict: "role,permission_key" })
    .select("*")
    .returns<RolePermission[]>();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "access.role_permissions_update",
    entityType: "role_permission",
    summary: `${profile.full_name} updated ${parsed.data.role} access permissions.`,
    metadata: {
      role: parsed.data.role,
      changed_count: rows.length,
      enabled_permissions: rows.filter((row) => row.enabled).map((row) => row.permission_key),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: `${parsed.data.role} access updated.`, data };
}

export async function updateEnterpriseSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = EnterpriseSettingsInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose valid enterprise settings." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can change enterprise settings." };
  }

  const allowedSettings = new Map(enterpriseSettingDefaults.map((setting) => [setting.setting_key, setting]));
  const rows = parsed.data.settings
    .filter((setting) => allowedSettings.has(setting.setting_key))
    .map((setting) => ({
      setting_key: setting.setting_key,
      setting_value: setting.setting_value,
      description: setting.description || allowedSettings.get(setting.setting_key)?.description || null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }));

  if (!rows.length) {
    return { ok: false, message: "No supported enterprise settings were selected." };
  }

  const { data, error } = await supabase
    .from("enterprise_settings")
    .upsert(rows, { onConflict: "setting_key" })
    .select("*");

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "settings.enterprise_policy_update",
    entityType: "enterprise_setting",
    summary: `${profile.full_name} updated enterprise policy settings.`,
    metadata: { setting_keys: rows.map((row) => row.setting_key) },
  });

  revalidatePath("/settings");
  return { ok: true, message: "Enterprise policy settings saved.", data };
}

export async function upsertProcessorPricingSettingAction(input: unknown): Promise<ActionResult> {
  const parsed = ProcessorPricingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Complete the processor pricing fields." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can manage processor pricing." };
  }

  const effectiveAt = normalizeDateOnly(parsed.data.effective_at);
  if (!effectiveAt) {
    return { ok: false, message: "Choose a valid effective date." };
  }

  const processorKey = normalizeProcessorKey(parsed.data.processor_name);
  const previous = parsed.data.id
    ? (
        await supabase
          .from("processor_pricing_settings")
          .select("*")
          .eq("id", parsed.data.id)
          .maybeSingle<ProcessorPricingSetting>()
      ).data ?? null
    : null;
  const payload = {
    processor_key: processorKey,
    processor_name: parsed.data.processor_name,
    pricing_unit: parsed.data.pricing_unit as ProcessorPricingUnit,
    rate_value: parsed.data.rate_value,
    flat_fee: parsed.data.flat_fee ?? null,
    effective_at: effectiveAt,
    is_active: parsed.data.is_active,
    notes: parsed.data.notes || null,
    updated_by: profile.id,
    ...(parsed.data.id ? {} : { created_by: profile.id }),
  };

  const write = parsed.data.id
    ? supabase.from("processor_pricing_settings").update(payload).eq("id", parsed.data.id)
    : supabase.from("processor_pricing_settings").insert(payload);

  const { data, error } = await write.select("*").single<ProcessorPricingSetting>();
  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: previous ? "processor_pricing.update" : "processor_pricing.create",
    entityType: "processor_pricing_setting",
    entityId: data.id,
    summary: `${profile.full_name} ${previous ? "updated" : "created"} ${data.processor_name} processor pricing.`,
    metadata: buildProcessorPricingAuditMetadata({ previous, next: data }),
  });

  revalidatePath("/settings");
  revalidatePath("/reports");
  revalidatePath("/compensation");
  return { ok: true, message: `${data.processor_name} processor pricing saved.`, data };
}

export async function recalculateProcessorPricingAction(input: unknown): Promise<ActionResult> {
  const parsed = ProcessorPricingRecalculationInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose valid recalculation options." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can recalculate processor pricing." };
  }

  const data = await getCrmData(supabase);
  const pricingSettings = data.processorPricingSettings;
  const dealUpdates = [];
  const residualUpdates = [];
  let skippedLockedResiduals = 0;

  if (parsed.data.includeDeals) {
    for (const deal of data.deals) {
      if (["processing", "lost", "inactive"].includes(deal.stage)) continue;
      const merchant = data.merchants.find((item) => item.id === deal.merchant_id);
      if (!merchant) continue;
      const estimate = calculateResidualBreakdown({
        processingVolume: deal.estimated_monthly_volume || merchant.monthly_volume_estimate,
        proposedRatePercent: deal.proposed_rate || merchant.proposed_rate,
        processorName: merchant.current_processor,
        pricingSettings,
        compensationRule: data.compensationRule,
        effectiveDate: new Date().toISOString().slice(0, 10),
      });
      if (Math.round(Number(deal.estimated_residual || 0) * 100) / 100 === estimate.netResidual) continue;
      const { error } = await supabase.from("deals").update({ estimated_residual: estimate.netResidual }).eq("id", deal.id);
      if (!error) dealUpdates.push({ deal_id: deal.id, merchant_id: merchant.id, estimated_residual: estimate.netResidual, processor_pricing: estimate.pricingSnapshot });
    }
  }

  if (parsed.data.includeResiduals) {
    for (const residual of data.residuals) {
      const protectedResidual = shouldProtectResidualFromRecalculation(data, residual);
      if (protectedResidual && !parsed.data.includeLockedResiduals) {
        skippedLockedResiduals += 1;
        continue;
      }
      const merchant = data.merchants.find((item) => item.id === residual.merchant_id);
      if (!merchant) continue;
      const patch = recalculateResidualRow({
        residual,
        merchant,
        pricingSettings,
        compensationRule: data.compensationRule,
      });
      const { error } = await supabase.from("residuals").update(patch).eq("id", residual.id);
      if (!error) {
        residualUpdates.push({
          residual_id: residual.id,
          merchant_id: merchant.id,
          net_residual: patch.net_residual,
          processor_cost: patch.processor_cost,
          protected: protectedResidual,
        });
      }
    }
  }

  await writeAuditLog(supabase, profile, {
    action: "processor_pricing.recalculate",
    entityType: "processor_pricing_setting",
    summary: `${profile.full_name} recalculated processor pricing effects.`,
    metadata: {
      include_deals: parsed.data.includeDeals,
      include_residuals: parsed.data.includeResiduals,
      include_locked_residuals: parsed.data.includeLockedResiduals,
      deal_count: dealUpdates.length,
      residual_count: residualUpdates.length,
      skipped_locked_residuals: skippedLockedResiduals,
      recalculation_triggered: true,
      deal_updates: dealUpdates.slice(0, 25),
      residual_updates: residualUpdates.slice(0, 25),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/compensation");
  revalidatePath("/analytics");
  return {
    ok: true,
    message: `Recalculated ${dealUpdates.length} deal estimate${dealUpdates.length === 1 ? "" : "s"} and ${residualUpdates.length} residual row${residualUpdates.length === 1 ? "" : "s"}. ${skippedLockedResiduals} locked/exported residual${skippedLockedResiduals === 1 ? "" : "s"} skipped.`,
    data: { dealUpdates, residualUpdates, skippedLockedResiduals },
  };
}

export async function generateFinancialExportAction(input: unknown): Promise<ActionResult> {
  const parsed = FinancialExportInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose valid finance export filters." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can export company financials." };
  }

  const data = await getCrmData(supabase);
  const filters = normalizeExportFilters(parsed.data);
  const exportResult = generateFinancialExport(data, filters);
  const format = parsed.data.format as ExportFormat;

  const { data: exportRow, error } = await supabase
    .from("financial_exports")
    .insert({
      requested_by: profile.id,
      export_format: format,
      filters,
      row_count: exportResult.rows.length,
      total_processing_volume: exportResult.totals.processingVolume,
      total_gross_processing_revenue: exportResult.totals.grossProcessingRevenue,
      total_processor_cost: exportResult.totals.processorCost,
      total_net_residual: exportResult.totals.netResidual,
      total_agent_payout: exportResult.totals.agentPayout,
      total_company_share: exportResult.totals.companyShare,
    })
    .select("*")
    .single();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "finance.export",
    entityType: "financial_export",
    entityId: exportRow?.id ?? null,
    summary: `${profile.full_name} generated a CPA-ready financial export.`,
    metadata: {
      ...buildExportAuditSummary("financial", exportResult.rows.length, filters),
      totals: exportResult.totals,
    },
  });

  revalidatePath("/reports");
  revalidatePath("/analytics");
  return {
    ok: true,
    message: format === "xlsx" ? "CSV export generated. XLSX can be enabled when an XLSX library is added." : "Financial export generated.",
    data: { ...exportResult, exportId: exportRow?.id ?? null, format: "csv" },
  };
}

export async function generatePayrollExportAction(input: unknown): Promise<ActionResult> {
  const parsed = PayrollExportInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose valid payroll export filters." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can export payroll information." };
  }

  const data = await getCrmData(supabase);
  const filters = normalizeExportFilters(parsed.data);
  const exportResult = generatePayrollExport(data, filters);
  const provider = parsed.data.provider || "manual";
  const format = parsed.data.format as ExportFormat;

  const { data: exportRow, error } = await supabase
    .from("payroll_exports")
    .insert({
      requested_by: profile.id,
      export_format: format,
      filters,
      row_count: exportResult.rows.length,
      gross_commissions: exportResult.totals.grossCommissions,
      adjustments_total: exportResult.totals.adjustmentsTotal,
      total_payout: exportResult.totals.totalPayout,
      provider,
    })
    .select("*")
    .single();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "payroll.export",
    entityType: "payroll_export",
    entityId: exportRow?.id ?? null,
    summary: `${profile.full_name} generated a payroll export.`,
    metadata: {
      ...buildExportAuditSummary("payroll", exportResult.rows.length, filters),
      provider,
      totals: exportResult.totals,
    },
  });

  await writeAgentActivity(supabase, {
    profileId: profile.id,
    actorProfileId: profile.id,
    eventType: "payroll.export.generated",
    eventSource: "payroll",
    provider,
    summary: `${profile.full_name} generated payroll export ${exportResult.filename}.`,
    metadata: { row_count: exportResult.rows.length, totals: exportResult.totals },
  });

  revalidatePath("/compensation");
  revalidatePath("/reports");
  return {
    ok: true,
    message: format === "xlsx" ? "CSV payroll export generated. XLSX can be enabled when an XLSX library is added." : "Payroll export generated.",
    data: { ...exportResult, exportId: exportRow?.id ?? null, format: "csv" },
  };
}

export async function connectPayrollIntegrationAction(input: unknown): Promise<ActionResult> {
  const parsed = PayrollIntegrationInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Complete the payroll integration fields." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can manage payroll integrations." };
  }

  if (!isIntegrationEncryptionConfigured()) {
    return { ok: false, message: "INTEGRATION_ENCRYPTION_KEY is required before payroll credentials can be stored." };
  }

  const testResult = await testPayrollIntegration({
    provider: parsed.data.provider as PayrollProviderId,
    accountIdentifier: parsed.data.account_identifier,
    credentials: parsed.data.credentials,
  });

  let sealedCredentials: string;
  try {
    sealedCredentials = sealPayrollCredentials(parsed.data.credentials);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Payroll credentials could not be encrypted." };
  }

  const provider = payrollProviders.find((item) => item.id === parsed.data.provider);
  const { data: integration, error } = await supabase
    .from("payroll_integrations")
    .insert({
      provider: parsed.data.provider,
      display_name: parsed.data.display_name,
      account_identifier: parsed.data.account_identifier,
      status: testResult.ok ? "connected" : "error",
      encrypted_credentials: sealedCredentials,
      metadata: {
        adapter_mode: testResult.metadata?.adapter_mode ?? "credential_validation",
        credential_fields: Object.keys(parsed.data.credentials).filter((key) => parsed.data.credentials[key]),
      },
      last_error: testResult.ok ? null : testResult.message,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("*")
    .single();

  if (error) return { ok: false, message: error.message };

  await writeAgentActivity(supabase, {
    profileId: profile.id,
    actorProfileId: profile.id,
    eventType: testResult.ok ? "payroll.integration.connect.success" : "payroll.integration.connect.warning",
    eventSource: "payroll",
    provider: parsed.data.provider,
    severity: testResult.ok ? "info" : "warning",
    summary: `${profile.full_name} connected ${provider?.name ?? parsed.data.provider} payroll integration.`,
    metadata: { status: integration.status, account_identifier: parsed.data.account_identifier },
  });

  await writeAuditLog(supabase, profile, {
    action: "payroll.integration.connect",
    entityType: "payroll_integration",
    entityId: integration.id,
    summary: `${profile.full_name} connected ${provider?.name ?? parsed.data.provider} payroll integration.`,
    metadata: { provider: parsed.data.provider, status: integration.status },
  });

  revalidatePath("/compensation");
  return { ok: true, message: testResult.message, data: integration };
}

export async function syncPayrollIntegrationAction(input: unknown): Promise<ActionResult> {
  const parsed = PayrollIntegrationIdInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid payroll integration." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can sync payroll integrations." };
  }

  const { data: integration, error } = await supabase
    .from("payroll_integrations")
    .select("*")
    .eq("id", parsed.data.integration_id)
    .single();

  if (error || !integration) {
    return { ok: false, message: error?.message ?? "Payroll integration was not found." };
  }

  const syncResult = await syncPayrollIntegration(integration);
  const now = new Date().toISOString();
  await supabase
    .from("payroll_integrations")
    .update({
      status: syncResult.status,
      last_sync_at: syncResult.ok ? now : integration.last_sync_at,
      last_error: syncResult.ok ? null : syncResult.message,
      updated_by: profile.id,
    })
    .eq("id", integration.id);

  await writeAgentActivity(supabase, {
    profileId: profile.id,
    actorProfileId: profile.id,
    eventType: syncResult.ok ? "payroll.integration.sync.success" : "payroll.integration.sync.failed",
    eventSource: "payroll",
    provider: integration.provider,
    severity: syncResult.ok ? "info" : "error",
    summary: syncResult.message,
    metadata: { records_processed: syncResult.recordsProcessed ?? 0 },
  });

  await writeAuditLog(supabase, profile, {
    action: "payroll.integration.sync",
    entityType: "payroll_integration",
    entityId: integration.id,
    summary: `${profile.full_name} synced payroll integration ${integration.display_name}.`,
    metadata: { provider: integration.provider, status: syncResult.status },
  });

  revalidatePath("/compensation");
  return { ok: syncResult.ok, message: syncResult.message, data: syncResult };
}

export async function disconnectPayrollIntegrationAction(input: unknown): Promise<ActionResult> {
  const parsed = PayrollIntegrationIdInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid payroll integration." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can disconnect payroll integrations." };
  }

  const now = new Date().toISOString();
  const { data: integration, error } = await supabase
    .from("payroll_integrations")
    .update({ status: "disconnected", disconnected_at: now, updated_by: profile.id, last_error: null })
    .eq("id", parsed.data.integration_id)
    .select("*")
    .single();

  if (error) return { ok: false, message: error.message };

  await writeAgentActivity(supabase, {
    profileId: profile.id,
    actorProfileId: profile.id,
    eventType: "payroll.integration.disconnect",
    eventSource: "payroll",
    provider: integration.provider,
    summary: `${profile.full_name} disconnected payroll integration ${integration.display_name}.`,
    metadata: { provider: integration.provider },
  });

  await writeAuditLog(supabase, profile, {
    action: "payroll.integration.disconnect",
    entityType: "payroll_integration",
    entityId: integration.id,
    summary: `${profile.full_name} disconnected payroll integration ${integration.display_name}.`,
    metadata: { provider: integration.provider },
  });

  revalidatePath("/compensation");
  return { ok: true, message: "Payroll integration disconnected.", data: integration };
}

export async function assignRecruitToTeamAction(input: unknown): Promise<ActionResult> {
  const parsed = AssignRecruitToTeamInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a recruit and team assignment." };
  }

  const { supabase, profile } = await getSessionContext();
  const data = await getCrmData(supabase);
  const team = data.teams.find((item) => item.id === parsed.data.team_id);
  const recruit = data.agentRecruits.find((item) => item.id === parsed.data.recruit_id);

  if (!team || !recruit) {
    return { ok: false, message: "Team or recruit was not found." };
  }

  const leaderAgent = data.agents.find((agent) => agent.id === team.leader_agent_id);
  const canManageTeam =
    profile.role === "admin" ||
    leaderAgent?.profile_id === profile.id ||
    data.profiles.some((manager) => manager.id === leaderAgent?.profile_id && manager.manager_id === profile.id);

  if (!canManageTeam) {
    return { ok: false, message: "You do not have access to manage this team." };
  }

  const limit = Number(
    data.enterpriseSettings.find((setting) => setting.setting_key === "team_recruit_limit")?.setting_value?.limit ??
      defaultTeamRecruitLimit,
  );
  const capacity = canAssignRecruitToTeam(data, team, recruit, Number.isFinite(limit) ? limit : defaultTeamRecruitLimit);
  if (!capacity.ok) {
    return { ok: false, message: capacity.reason ?? "This team is at its recruit limit." };
  }

  const leaderProfileId = leaderAgent?.profile_id;
  if (!leaderProfileId) {
    return { ok: false, message: "Team leader profile was not found." };
  }

  const { error: recruitError } = await supabase
    .from("agent_recruits")
    .update({ assigned_recruiter_id: leaderProfileId, updated_at: new Date().toISOString() })
    .eq("id", recruit.id);

  if (recruitError) return { ok: false, message: recruitError.message };

  const progressPercent = progressForRecruitStatus(recruit.status as RecruitStatus);
  const { error: progressError } = await supabase.from("recruit_progress").insert({
    recruit_id: recruit.id,
    team_id: team.id,
    author_profile_id: profile.id,
    status: recruit.status,
    progress_percent: progressPercent,
    note: parsed.data.note || `Assigned to team ${team.team_number}.`,
  });

  if (progressError) return { ok: false, message: progressError.message };

  await writeAuditLog(supabase, profile, {
    action: "team.recruit_assign",
    entityType: "agent_recruit",
    entityId: recruit.id,
    summary: `${profile.full_name} assigned ${recruit.full_name} to team ${team.team_number}.`,
    metadata: { team_id: team.id, leader_agent_id: team.leader_agent_id },
  });

  revalidatePath("/teams");
  revalidatePath("/recruitment");
  revalidatePath("/analytics");
  return { ok: true, message: `${recruit.full_name} was assigned to team ${team.team_number}.` };
}

export async function updateRecruitProgressAction(input: unknown): Promise<ActionResult> {
  const parsed = RecruitProgressInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid recruit progress update." };
  }

  const { supabase, profile } = await getSessionContext();
  const progressPercent = parsed.data.progress_percent ?? progressForRecruitStatus(parsed.data.status as RecruitStatus);

  const { data: recruit, error: recruitError } = await supabase
    .from("agent_recruits")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.recruit_id)
    .select("id,full_name,status")
    .single<{ id: string; full_name: string; status: RecruitStatus }>();

  if (recruitError) return { ok: false, message: recruitError.message };

  const { data: progress, error } = await supabase
    .from("recruit_progress")
    .insert({
      recruit_id: parsed.data.recruit_id,
      team_id: parsed.data.team_id || null,
      author_profile_id: profile.id,
      status: parsed.data.status,
      progress_percent: progressPercent,
      note: parsed.data.note || null,
    })
    .select("*")
    .single();

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, profile, {
    action: "team.recruit_progress",
    entityType: "agent_recruit",
    entityId: recruit.id,
    summary: `${profile.full_name} moved ${recruit.full_name} to ${parsed.data.status}.`,
    metadata: { status: parsed.data.status, progress_percent: progressPercent, team_id: parsed.data.team_id || null },
  });

  revalidatePath("/teams");
  revalidatePath("/recruitment");
  revalidatePath("/analytics");
  return { ok: true, message: "Recruit progress updated.", data: progress };
}

export async function saveUnderwritingRulesAction(input: unknown): Promise<ActionResult> {
  const parsed = UnderwritingRulesInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose valid underwriting rules." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can update underwriting rules." };
  }

  for (const rule of parsed.data.rules) {
    const validation = validateUnderwritingRule(rule);
    if (validation) {
      return { ok: false, message: `${rule.name}: ${validation}` };
    }
  }

  const rows = parsed.data.rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    outcome: rule.outcome,
    enabled: rule.enabled,
    priority: rule.priority,
    conditions: rule.conditions,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  }));

  if (parsed.data.deletedRuleIds.length) {
    const { error: deleteError } = await supabase
      .from("underwriting_rules")
      .delete()
      .in("id", parsed.data.deletedRuleIds);

    if (deleteError) return { ok: false, message: deleteError.message };
  }

  const { data, error } = await supabase
    .from("underwriting_rules")
    .upsert(rows, { onConflict: "id" })
    .select("*");

  if (error) return { ok: false, message: error.message };

  if (parsed.data.autoDecisionsEnabled !== undefined) {
    const { error: settingsError } = await supabase
      .from("enterprise_settings")
      .upsert(
        {
          setting_key: "underwriting_auto_decisions_enabled",
          setting_value: { enabled: parsed.data.autoDecisionsEnabled },
          description: "Allow underwriting rules to automatically approve, decline, or route applications to manual review.",
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_key" },
      );

    if (settingsError) return { ok: false, message: settingsError.message };
  }

  await writeAuditLog(supabase, profile, {
    action: "underwriting.rules_update",
    entityType: "underwriting_rule",
    summary: `${profile.full_name} updated underwriting automation rules.`,
    metadata: {
      rule_count: rows.length,
      enabled_count: rows.filter((rule) => rule.enabled).length,
      deleted_rule_count: parsed.data.deletedRuleIds.length,
      auto_decisions_enabled: parsed.data.autoDecisionsEnabled ?? null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/merchant-onboarding");
  return { ok: true, message: "Underwriting rules saved.", data };
}

export async function runUnderwritingDecisionAction(input: unknown): Promise<ActionResult> {
  const parsed = UnderwritingRunInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid underwriting record." };
  }

  const { supabase, profile } = await getSessionContext();
  if (profile.role !== "admin") {
    return { ok: false, message: "Only admins can run underwriting automation." };
  }

  const onboardingIds = parsed.data.onboarding_id
    ? [parsed.data.onboarding_id]
    : (
        await supabase
          .from("merchant_onboarding_records")
          .select("id")
          .in("status", ["under_review", "documents_needed", "application_started"])
          .limit(25)
      ).data?.map((record) => record.id as string) ?? [];

  if (!onboardingIds.length) {
    return { ok: false, message: "No merchant applications are ready for underwriting." };
  }

  const results = [];
  for (const onboardingId of onboardingIds) {
    try {
      results.push(await evaluateAndPersistUnderwritingDecision(supabase, profile, onboardingId));
    } catch (error) {
      results.push({
        onboardingId,
        error: error instanceof Error ? error.message : "Underwriting evaluation failed.",
      });
    }
  }

  revalidatePath("/settings");
  revalidatePath("/merchant-onboarding");
  revalidatePath("/opportunities");
  revalidatePath("/analytics");
  return {
    ok: results.every((result) => !("error" in result)),
    message: `Underwriting evaluated ${results.length} application${results.length === 1 ? "" : "s"}.`,
    data: results,
  };
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

  const [processorPricingSettings, compensationRule] = await Promise.all([
    loadProcessorPricingSettings(supabase),
    loadCompensationRule(supabase),
  ]);
  const baseResidualPercentage = Number(compensationRule.base_residual_percentage ?? 40);
  const errors = [...parsedCsv.errors];
  const residualRows = [];

  for (const row of parsedCsv.rows) {
    const merchantQuery = row.merchant_id
      ? supabase.from("merchants").select("id,assigned_agent_id,business_name,current_processor,proposed_rate").eq("id", row.merchant_id)
      : supabase.from("merchants").select("id,assigned_agent_id,business_name,current_processor,proposed_rate").ilike("business_name", row.business_name ?? "");

    const { data: merchant, error } = await merchantQuery.maybeSingle<{
      id: string;
      assigned_agent_id: string;
      business_name: string;
      current_processor: string | null;
      proposed_rate: number;
    }>();

    if (error || !merchant) {
      errors.push(`Line ${row.lineNumber}: merchant was not found.`);
      continue;
    }

    const netResidual = row.net_residual;
    const agentResidualAmount = netResidual * (baseResidualPercentage / 100);
    const processorEstimate = calculateResidualBreakdown({
      processingVolume: row.processing_volume,
      proposedRatePercent: Number(merchant.proposed_rate || 0),
      processorName: merchant.current_processor,
      pricingSettings: processorPricingSettings,
      compensationRule,
      effectiveDate: row.month ? normalizeImportMonth(row.month) : statementMonth,
    });
    residualRows.push({
      merchant_id: merchant.id,
      agent_id: row.agent_id || merchant.assigned_agent_id,
      month: row.month ? normalizeImportMonth(row.month) : statementMonth,
      processing_volume: row.processing_volume,
      net_residual: netResidual,
      agent_residual_amount: agentResidualAmount,
      company_share: netResidual - agentResidualAmount,
      gross_processing_revenue: processorEstimate.grossProcessingRevenue,
      processor_cost: processorEstimate.processorCost,
      processor_pricing_setting_id: processorEstimate.appliedSetting?.id.startsWith("default-") ? null : processorEstimate.appliedSetting?.id ?? null,
      processor_pricing_snapshot: processorEstimate.pricingSnapshot,
    });
  }

  if (residualRows.length) {
    const { error } = await supabase.from("residuals").upsert(residualRows, { onConflict: "merchant_id,month" });
    if (error) {
      errors.push(error.message);
    }
  }

  const status = errors.length ? (residualRows.length ? "completed" : "failed") : "completed";
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

  revalidatePath("/dashboard");
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

  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { ok: true, message: "Task created.", data };
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus): Promise<ActionResult> {
  const { supabase } = await getSessionContext();
  const { data, error } = await supabase.from("tasks").update({ status }).eq("id", taskId).select("*").single<Task>();

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
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
  supabase: SupabaseClient,
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

async function findExistingProfile(supabase: SupabaseClient, userId: string, email: string) {
  const { data: profileByUserId, error: userError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();

  if (userError) throw userError;
  if (profileByUserId) return profileByUserId;

  const { data: profileByEmail, error: emailError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();

  if (emailError) throw emailError;
  return profileByEmail ?? null;
}

function toIsoOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function getCurrentAgentId(supabase: SupabaseClient, profileId: string) {
  const { data } = await supabase.from("agents").select("id").eq("profile_id", profileId).maybeSingle<{ id: string }>();
  return data?.id ?? null;
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

async function loadCompensationRule(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("compensation_rules")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

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

async function profileIdForAgent(supabase: SupabaseClient, agentId: string) {
  const { data } = await supabase.from("agents").select("profile_id").eq("id", agentId).maybeSingle<{ profile_id: string }>();
  return data?.profile_id ?? null;
}

async function createFollowUpTask(
  supabase: SupabaseClient,
  profileId: string,
  input: { title: string; description: string; dueDate: string; merchantId?: string | null },
) {
  await supabase.from("tasks").insert({
    title: input.title,
    description: input.description,
    assigned_to: profileId,
    merchant_id: input.merchantId || null,
    due_date: input.dueDate,
    priority: "medium",
    status: "open",
  });
}

function normalizeExportFilters(input: {
  dateFrom?: string;
  dateTo?: string;
  teamId?: string;
  agentId?: string;
  status?: string;
  processor?: string;
}) {
  return {
    dateFrom: input.dateFrom || undefined,
    dateTo: input.dateTo || undefined,
    teamId: input.teamId && input.teamId !== "all" ? input.teamId : undefined,
    agentId: input.agentId && input.agentId !== "all" ? input.agentId : undefined,
    status: input.status && input.status !== "all" ? input.status : undefined,
    processor: input.processor && input.processor !== "all" ? input.processor : undefined,
  };
}

function normalizeDateOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function refreshAgentOnboardingProgress(supabase: SupabaseClient, onboardingId: string) {
  const { data: steps, error } = await supabase
    .from("agent_onboarding_steps")
    .select("completed_at")
    .eq("onboarding_id", onboardingId);

  if (error || !steps?.length) return;

  const completed = steps.filter((step) => step.completed_at).length;
  const trainingProgress = Math.round((completed / steps.length) * 100);
  await supabase
    .from("agent_onboarding_records")
    .update({
      training_progress: trainingProgress,
      profile_complete: trainingProgress >= 20,
      documents_signed: trainingProgress >= 50,
      account_activated: trainingProgress >= 100,
      status: trainingProgress >= 100 ? "active" : trainingProgress >= 50 ? "under_review" : "training",
    })
    .eq("id", onboardingId);
}

function mapMerchantOnboardingStatus(status: MerchantOnboardingStatus): MerchantStatus {
  if (status === "application_started") return "application_sent";
  if (status === "documents_needed" || status === "under_review") return "underwriting";
  if (status === "active") return "onboarded";
  if (status === "declined") return "lost";
  return status;
}

function revalidateWorkflowPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  revalidatePath("/recruitment");
  revalidatePath("/agent-onboarding");
  revalidatePath("/merchant-onboarding");
  revalidatePath("/documents");
  revalidatePath("/analytics");
  revalidatePath("/tasks");
  revalidatePath("/notifications");
}
