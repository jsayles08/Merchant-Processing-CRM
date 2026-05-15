import type { SupabaseClient } from "@supabase/supabase-js";
import { demoData } from "@/lib/demo-data";
import type {
  Agent,
  AgentActivityLog,
  AgentOnboardingRecord,
  AgentOnboardingStep,
  AgentPresence,
  AgentRecruit,
  AgentRecruitUpdate,
  AuditLog,
  CompensationRule,
  CopilotMemory,
  CrmData,
  Deal,
  Document,
  DocumentStorageMigrationStatus,
  EnterpriseSetting,
  FinancialExport,
  Merchant,
  MerchantOnboardingRecord,
  MerchantOnboardingStep,
  MerchantUpdate,
  PayrollAdjustment,
  PayrollExport,
  PayrollIntegration,
  Profile,
  ProcessorConnection,
  ProcessorSyncRun,
  RecruitProgress,
  Residual,
  ResidualImportBatch,
  RolePermission,
  SignatureRequest,
  Task,
  Team,
  TeamMember,
  UnderwritingDecision,
  UnderwritingRule,
} from "@/lib/types";
import { hydrateEnterpriseSettings, hydrateRolePermissions } from "@/lib/permissions";

export type MerchantDetailData = {
  merchant: Merchant;
  deal: Deal | null;
  assignedAgent: Agent | null;
  assignedProfile: Profile | null;
  updates: MerchantUpdate[];
  tasks: Task[];
  documents: Document[];
  residuals: Residual[];
};

const defaultRule = demoData.compensationRule;

export async function getCrmData(supabase: SupabaseClient): Promise<CrmData> {
  const [
    profiles,
    agents,
    merchants,
    deals,
    merchantUpdates,
    tasks,
    documents,
    agentRecruits,
    agentRecruitUpdates,
    agentOnboardingRecords,
    agentOnboardingSteps,
    merchantOnboardingRecords,
    merchantOnboardingSteps,
    signatureRequests,
    residuals,
    residualImportBatches,
    teams,
    teamMembers,
    recruitProgress,
    compensationRules,
    rolePermissions,
    enterpriseSettings,
    copilotMemories,
    processorConnections,
    processorSyncRuns,
    financialExports,
    payrollExports,
    payrollIntegrations,
    payrollAdjustments,
    underwritingRules,
    underwritingDecisions,
    agentPresence,
    agentActivityLogs,
    auditLogs,
  ] = await Promise.all([
    selectAll<Profile>(supabase, "profiles", "created_at"),
    selectAll<Agent>(supabase, "agents", "created_at"),
    selectAll<Merchant>(supabase, "merchants", "updated_at", false),
    selectAll<Deal>(supabase, "deals", "updated_at", false),
    selectAll<MerchantUpdate>(supabase, "merchant_updates", "created_at", false),
    selectAll<Task>(supabase, "tasks", "due_date"),
    selectAll<Document>(supabase, "documents", "created_at", false),
    selectOptionalAll<AgentRecruit>(supabase, "agent_recruits", "updated_at", false),
    selectOptionalAll<AgentRecruitUpdate>(supabase, "agent_recruit_updates", "created_at", false),
    selectOptionalAll<AgentOnboardingRecord>(supabase, "agent_onboarding_records", "updated_at", false),
    selectOptionalAll<AgentOnboardingStep>(supabase, "agent_onboarding_steps", "step_order"),
    selectOptionalAll<MerchantOnboardingRecord>(supabase, "merchant_onboarding_records", "updated_at", false),
    selectOptionalAll<MerchantOnboardingStep>(supabase, "merchant_onboarding_steps", "step_order"),
    selectOptionalAll<SignatureRequest>(supabase, "signature_requests", "updated_at", false),
    selectAll<Residual>(supabase, "residuals", "month", false),
    selectOptionalAll<ResidualImportBatch>(supabase, "residual_import_batches", "created_at", false),
    selectAll<Team>(supabase, "teams", "created_at"),
    selectAll<TeamMember>(supabase, "team_members", "created_at"),
    selectOptionalAll<RecruitProgress>(supabase, "recruit_progress", "created_at", false),
    selectAll<CompensationRule>(supabase, "compensation_rules", "created_at", false),
    selectOptionalAll<RolePermission>(supabase, "role_permissions", "updated_at", false),
    selectOptionalAll<EnterpriseSetting>(supabase, "enterprise_settings", "updated_at", false),
    selectOptionalAll<CopilotMemory>(supabase, "copilot_memories", "updated_at", false),
    selectOptionalAll<ProcessorConnection>(supabase, "processor_connections", "updated_at", false),
    selectOptionalAll<ProcessorSyncRun>(supabase, "processor_sync_runs", "started_at", false),
    selectOptionalAll<FinancialExport>(supabase, "financial_exports", "created_at", false),
    selectOptionalAll<PayrollExport>(supabase, "payroll_exports", "created_at", false),
    selectOptionalAll<PayrollIntegration>(supabase, "payroll_integrations", "updated_at", false),
    selectOptionalAll<PayrollAdjustment>(supabase, "payroll_adjustments", "effective_date", false),
    selectOptionalAll<UnderwritingRule>(supabase, "underwriting_rules", "priority"),
    selectOptionalAll<UnderwritingDecision>(supabase, "underwriting_decisions", "created_at", false),
    selectOptionalAll<AgentPresence>(supabase, "agent_presence", "last_seen_at", false),
    selectOptionalAll<AgentActivityLog>(supabase, "agent_activity_logs", "created_at", false),
    selectOptionalAll<AuditLog>(supabase, "audit_logs", "created_at", false),
  ]);

  return {
    profiles,
    agents,
    merchants,
    deals,
    merchantUpdates,
    tasks,
    documents,
    agentRecruits,
    agentRecruitUpdates,
    agentOnboardingRecords,
    agentOnboardingSteps,
    merchantOnboardingRecords,
    merchantOnboardingSteps,
    signatureRequests,
    residuals,
    residualImportBatches,
    teams,
    teamMembers,
    recruitProgress,
    compensationRule: compensationRules[0] ?? defaultRule,
    rolePermissions: hydrateRolePermissions(rolePermissions),
    enterpriseSettings: hydrateEnterpriseSettings(enterpriseSettings),
    copilotMemories,
    processorConnections,
    processorSyncRuns,
    financialExports,
    payrollExports,
    payrollIntegrations,
    payrollAdjustments,
    underwritingRules,
    underwritingDecisions,
    agentPresence,
    agentActivityLogs,
    auditLogs,
  };
}

export async function getDocumentStorageMigrationStatus(
  supabase: SupabaseClient,
): Promise<DocumentStorageMigrationStatus> {
  const [total, publicHttp, publicRelative] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }).like("file_url", "http%"),
    supabase.from("documents").select("id", { count: "exact", head: true }).like("file_url", "/%"),
  ]);

  if (total.error || publicHttp.error || publicRelative.error) {
    return { total_documents: 0, public_url_documents: 0, private_path_documents: 0 };
  }

  const totalDocuments = total.count ?? 0;
  const publicUrlDocuments = (publicHttp.count ?? 0) + (publicRelative.count ?? 0);
  return {
    total_documents: totalDocuments,
    public_url_documents: publicUrlDocuments,
    private_path_documents: Math.max(totalDocuments - publicUrlDocuments, 0),
  };
}

export async function getMerchantDetailData(
  supabase: SupabaseClient,
  merchantId: string,
): Promise<MerchantDetailData | null> {
  const { data: merchant, error } = await supabase.from("merchants").select("*").eq("id", merchantId).single<Merchant>();

  if (error || !merchant) return null;

  const [deal, assignedAgent, updates, tasks, documents, residuals] = await Promise.all([
    maybeSingle<Deal>(supabase, "deals", "merchant_id", merchantId),
    maybeSingle<Agent>(supabase, "agents", "id", merchant.assigned_agent_id),
    selectWhere<MerchantUpdate>(supabase, "merchant_updates", "merchant_id", merchantId, "created_at", false),
    selectWhere<Task>(supabase, "tasks", "merchant_id", merchantId, "due_date"),
    selectWhere<Document>(supabase, "documents", "merchant_id", merchantId, "created_at", false),
    selectWhere<Residual>(supabase, "residuals", "merchant_id", merchantId, "month", false),
  ]);

  let assignedProfile: Profile | null = null;
  if (assignedAgent) {
    assignedProfile = await maybeSingle<Profile>(supabase, "profiles", "id", assignedAgent.profile_id);
  }

  return {
    merchant,
    deal,
    assignedAgent,
    assignedProfile,
    updates,
    tasks,
    documents: await signMerchantDocuments(supabase, documents),
    residuals,
  };
}

async function selectAll<T>(
  supabase: SupabaseClient,
  table: string,
  orderBy: string,
  ascending = true,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending });
  if (error) throw error;
  return (data ?? []) as T[];
}

async function selectOptionalAll<T>(
  supabase: SupabaseClient,
  table: string,
  orderBy: string,
  ascending = true,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending });
  if (error) {
    console.warn(`Optional table ${table} is not available yet.`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

async function selectWhere<T>(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
  orderBy: string,
  ascending = true,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*").eq(column, value).order(orderBy, { ascending });
  if (error) throw error;
  return (data ?? []) as T[];
}

async function maybeSingle<T>(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<T | null> {
  const { data, error } = await supabase.from(table).select("*").eq(column, value).maybeSingle<T>();
  if (error) throw error;
  return data ?? null;
}

async function signMerchantDocuments(supabase: SupabaseClient, documents: Document[]): Promise<Document[]> {
  return Promise.all(
    documents.map(async (document) => {
      if (document.file_url.startsWith("http") || document.file_url.startsWith("/")) {
        return document;
      }

      const { data, error } = await supabase.storage
        .from("merchant-documents")
        .createSignedUrl(document.file_url, 60 * 10);

      if (error || !data?.signedUrl) {
        return document;
      }

      return { ...document, file_url: data.signedUrl };
    }),
  );
}
