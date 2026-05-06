import type { SupabaseClient } from "@supabase/supabase-js";
import { demoData } from "@/lib/demo-data";
import type {
  Agent,
  CompensationRule,
  CrmData,
  Deal,
  Document,
  Merchant,
  MerchantUpdate,
  Profile,
  Residual,
  Task,
  Team,
  TeamMember,
} from "@/lib/types";

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
    residuals,
    teams,
    teamMembers,
    compensationRules,
  ] = await Promise.all([
    selectAll<Profile>(supabase, "profiles", "created_at"),
    selectAll<Agent>(supabase, "agents", "created_at"),
    selectAll<Merchant>(supabase, "merchants", "updated_at", false),
    selectAll<Deal>(supabase, "deals", "updated_at", false),
    selectAll<MerchantUpdate>(supabase, "merchant_updates", "created_at", false),
    selectAll<Task>(supabase, "tasks", "due_date"),
    selectAll<Document>(supabase, "documents", "created_at", false),
    selectAll<Residual>(supabase, "residuals", "month", false),
    selectAll<Team>(supabase, "teams", "created_at"),
    selectAll<TeamMember>(supabase, "team_members", "created_at"),
    selectAll<CompensationRule>(supabase, "compensation_rules", "created_at", false),
  ]);

  return {
    profiles,
    agents,
    merchants,
    deals,
    merchantUpdates,
    tasks,
    documents,
    residuals,
    teams,
    teamMembers,
    compensationRule: compensationRules[0] ?? defaultRule,
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
