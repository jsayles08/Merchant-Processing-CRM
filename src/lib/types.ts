export type Role = "admin" | "manager" | "agent";

export type MerchantStatus =
  | "lead"
  | "contacted"
  | "qualified"
  | "application_sent"
  | "underwriting"
  | "approved"
  | "onboarded"
  | "processing"
  | "inactive"
  | "lost";

export type ApprovalStatus = "not_required" | "pending" | "approved" | "denied";
export type Priority = "low" | "medium" | "high";
export type TaskStatus = "open" | "completed" | "overdue";
export type RecruitStatus =
  | "new_lead"
  | "contacted"
  | "interested"
  | "application_started"
  | "onboarding"
  | "active"
  | "rejected";
export type AgentOnboardingStatus =
  | "invited"
  | "profile_incomplete"
  | "training"
  | "documents_pending"
  | "under_review"
  | "approved"
  | "active";
export type MerchantOnboardingStatus =
  | "lead"
  | "contacted"
  | "application_started"
  | "documents_needed"
  | "under_review"
  | "approved"
  | "active"
  | "declined";
export type SignatureStatus = "draft" | "sent" | "viewed" | "signed" | "declined" | "expired";
export type SignatureEntityType = "agent" | "recruit" | "merchant" | "account";
export type ProcessorProviderId = "fiserv" | "nuvei" | "other";
export type ProcessorAuthType = "oauth" | "api_key" | "merchant_credentials";
export type ProcessorConnectionStatus = "pending" | "connected" | "error" | "disconnected" | "syncing";
export type ProcessorSyncStatus = "queued" | "running" | "success" | "error";
export type ProcessorPricingUnit = "basis_points" | "percentage" | "flat_fee" | "basis_points_plus_flat" | "percentage_plus_flat";
export type PresenceStatus = "online" | "away" | "offline";
export type ActivitySeverity = "info" | "warning" | "error" | "security";
export type ExportFormat = "csv" | "xlsx";
export type PayrollProviderId = "stripe" | "gusto" | "manual";
export type PayrollIntegrationStatus = "pending" | "connected" | "error" | "disconnected" | "syncing";
export type PayrollAdjustmentStatus = "pending" | "approved" | "paid" | "void";
export type UnderwritingOutcome = "approve" | "deny" | "manual_review";
export type UnderwritingDecisionStatus = "approved" | "declined" | "manual_review";

export type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: Role;
  phone: string;
  status: "active" | "invited" | "inactive";
  manager_id: string | null;
  created_at: string;
};

export type Agent = {
  id: string;
  profile_id: string;
  agent_code: string;
  sponsor_agent_id: string | null;
  team_number: number;
  team_position: number;
  status: "active" | "ramping" | "inactive";
  start_date: string;
  created_at: string;
};

export type Merchant = {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  business_address: string;
  industry: string;
  monthly_volume_estimate: number;
  average_ticket: number;
  current_processor: string;
  proposed_rate: number;
  status: MerchantStatus;
  assigned_agent_id: string;
  processing_start_date: string | null;
  is_verified: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Deal = {
  id: string;
  merchant_id: string;
  agent_id: string;
  stage: MerchantStatus;
  proposed_rate: number;
  requires_management_approval: boolean;
  approval_status: ApprovalStatus;
  estimated_monthly_volume: number;
  estimated_residual: number;
  close_probability: number;
  expected_close_date: string;
  created_at: string;
  updated_at: string;
};

export type MerchantUpdate = {
  id: string;
  merchant_id: string;
  agent_id: string;
  update_type: string;
  note: string;
  next_follow_up_date: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  merchant_id: string | null;
  due_date: string;
  priority: Priority;
  status: TaskStatus;
  created_at: string;
};

export type Document = {
  id: string;
  merchant_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  document_type: string;
  created_at: string;
};

export type AgentRecruit = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  source: string | null;
  status: RecruitStatus;
  assigned_recruiter_id: string | null;
  created_by: string | null;
  follow_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentRecruitUpdate = {
  id: string;
  recruit_id: string;
  author_profile_id: string | null;
  status: RecruitStatus | null;
  note: string;
  follow_up_at: string | null;
  created_at: string;
};

export type AgentOnboardingRecord = {
  id: string;
  profile_id: string | null;
  recruit_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  assigned_admin_id: string | null;
  status: AgentOnboardingStatus;
  profile_complete: boolean;
  training_progress: number;
  documents_signed: boolean;
  account_activated: boolean;
  admin_approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentOnboardingStep = {
  id: string;
  onboarding_id: string;
  title: string;
  description: string | null;
  step_order: number;
  completed_at: string | null;
  created_at: string;
};

export type MerchantOnboardingRecord = {
  id: string;
  merchant_id: string | null;
  business_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string | null;
  processing_needs: string | null;
  monthly_volume_estimate: number;
  average_ticket: number;
  current_processor: string | null;
  status: MerchantOnboardingStatus;
  assigned_agent_id: string | null;
  follow_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MerchantOnboardingStep = {
  id: string;
  onboarding_id: string;
  title: string;
  description: string | null;
  step_order: number;
  completed_at: string | null;
  created_at: string;
};

export type SignatureRequest = {
  id: string;
  title: string;
  recipient_name: string;
  recipient_email: string;
  recipient_profile_id: string | null;
  related_entity_type: SignatureEntityType;
  related_entity_id: string | null;
  document_id: string | null;
  provider: string;
  provider_request_id: string | null;
  signing_url: string | null;
  status: SignatureStatus;
  metadata: Record<string, unknown>;
  created_by: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Residual = {
  id: string;
  merchant_id: string;
  agent_id: string;
  month: string;
  processing_volume: number;
  net_residual: number;
  agent_residual_amount: number;
  company_share: number;
  gross_processing_revenue?: number | null;
  processor_cost?: number | null;
  processor_pricing_setting_id?: string | null;
  processor_pricing_snapshot?: Record<string, unknown> | null;
  calculation_locked?: boolean;
  recalculated_at?: string | null;
  created_at: string;
};

export type ResidualImportBatch = {
  id: string;
  uploaded_by: string;
  processor_name: string;
  statement_month: string;
  row_count: number;
  imported_count: number;
  error_count: number;
  status: "pending" | "completed" | "failed";
  error_summary: string | null;
  created_at: string;
};

export type Team = {
  id: string;
  leader_agent_id: string;
  team_number: number;
  created_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  agent_id: string;
  sponsor_agent_id: string;
  active_recruit_status: boolean;
  active_status_date: string | null;
  created_at: string;
};

export type RecruitProgress = {
  id: string;
  recruit_id: string;
  team_id: string | null;
  author_profile_id: string | null;
  status: RecruitStatus;
  progress_percent: number;
  note: string | null;
  created_at: string;
};

export type CompensationRule = {
  id: string;
  rule_name: string;
  base_residual_percentage: number;
  minimum_processing_rate: number;
  override_per_active_recruit: number;
  max_override_per_team: number;
  active_recruit_required_merchants: number;
  active_recruit_required_processing_days: number;
  created_at: string;
};

export type RolePermission = {
  id: string;
  role: Role;
  permission_key: string;
  enabled: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EnterpriseSetting = {
  setting_key: string;
  setting_value: Record<string, unknown>;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type CopilotMemory = {
  id: string;
  scope: "company" | "merchant" | "agent" | "user";
  title: string;
  content: string;
  entity_id: string | null;
  confidence: number;
  source_type: string;
  source_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcessorConnection = {
  id: string;
  provider: ProcessorProviderId | string;
  display_name: string;
  account_identifier: string;
  agent_profile_id: string;
  created_by: string | null;
  updated_by: string | null;
  auth_type: ProcessorAuthType;
  status: ProcessorConnectionStatus;
  metadata: Record<string, unknown>;
  last_sync_at: string | null;
  last_tested_at: string | null;
  last_error: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcessorSyncRun = {
  id: string;
  connection_id: string;
  status: ProcessorSyncStatus;
  started_at: string;
  finished_at: string | null;
  records_processed: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
};

export type ProcessorPricingSetting = {
  id: string;
  processor_key: string;
  processor_name: string;
  pricing_unit: ProcessorPricingUnit;
  rate_value: number;
  flat_fee: number | null;
  effective_at: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialExport = {
  id: string;
  requested_by: string | null;
  export_format: ExportFormat;
  filters: Record<string, unknown>;
  row_count: number;
  total_processing_volume: number;
  total_gross_processing_revenue?: number;
  total_processor_cost?: number;
  total_net_residual: number;
  total_agent_payout: number;
  total_company_share: number;
  created_at: string;
};

export type PayrollExport = {
  id: string;
  requested_by: string | null;
  export_format: ExportFormat;
  filters: Record<string, unknown>;
  row_count: number;
  gross_commissions: number;
  adjustments_total: number;
  total_payout: number;
  status: string;
  provider: string | null;
  created_at: string;
};

export type PayrollIntegration = {
  id: string;
  provider: PayrollProviderId | string;
  display_name: string;
  account_identifier: string;
  status: PayrollIntegrationStatus;
  metadata: Record<string, unknown>;
  last_sync_at: string | null;
  last_error: string | null;
  created_by: string | null;
  updated_by: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PayrollAdjustment = {
  id: string;
  agent_id: string;
  amount: number;
  reason: string;
  status: PayrollAdjustmentStatus;
  effective_date: string;
  created_by: string | null;
  created_at: string;
};

export type UnderwritingRule = {
  id: string;
  name: string;
  outcome: UnderwritingOutcome;
  enabled: boolean;
  priority: number;
  conditions: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UnderwritingDecision = {
  id: string;
  merchant_onboarding_id: string;
  merchant_id: string | null;
  decision: UnderwritingDecisionStatus;
  triggered_rule_ids: string[];
  reasons: Record<string, unknown>;
  evaluated_by: string | null;
  created_at: string;
};

export type AgentPresence = {
  profile_id: string;
  status: PresenceStatus;
  last_seen_at: string;
  current_path: string | null;
  user_agent: string | null;
  updated_at: string;
};

export type AgentActivityLog = {
  id: string;
  profile_id: string | null;
  actor_profile_id: string | null;
  event_type: string;
  event_source: string;
  provider: string | null;
  connection_id: string | null;
  severity: ActivitySeverity;
  summary: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type CrmData = {
  profiles: Profile[];
  agents: Agent[];
  merchants: Merchant[];
  deals: Deal[];
  merchantUpdates: MerchantUpdate[];
  tasks: Task[];
  documents: Document[];
  agentRecruits: AgentRecruit[];
  agentRecruitUpdates: AgentRecruitUpdate[];
  agentOnboardingRecords: AgentOnboardingRecord[];
  agentOnboardingSteps: AgentOnboardingStep[];
  merchantOnboardingRecords: MerchantOnboardingRecord[];
  merchantOnboardingSteps: MerchantOnboardingStep[];
  signatureRequests: SignatureRequest[];
  residuals: Residual[];
  residualImportBatches: ResidualImportBatch[];
  teams: Team[];
  teamMembers: TeamMember[];
  recruitProgress: RecruitProgress[];
  compensationRule: CompensationRule;
  rolePermissions: RolePermission[];
  enterpriseSettings: EnterpriseSetting[];
  copilotMemories: CopilotMemory[];
  processorConnections: ProcessorConnection[];
  processorSyncRuns: ProcessorSyncRun[];
  processorPricingSettings: ProcessorPricingSetting[];
  financialExports: FinancialExport[];
  payrollExports: PayrollExport[];
  payrollIntegrations: PayrollIntegration[];
  payrollAdjustments: PayrollAdjustment[];
  underwritingRules: UnderwritingRule[];
  underwritingDecisions: UnderwritingDecision[];
  agentPresence: AgentPresence[];
  agentActivityLogs: AgentActivityLog[];
  auditLogs: AuditLog[];
};

export type CopilotActionStatus = "suggested" | "requires_confirmation" | "confirmed" | "completed" | "dismissed" | "failed";

export type CopilotAction = {
  id: string;
  user_id: string;
  merchant_id: string | null;
  action_type: string;
  action_summary: string;
  status: CopilotActionStatus;
  payload: Record<string, unknown> | null;
  created_at: string;
  confirmed_at?: string | null;
};

export type CopilotMessage = {
  id: string;
  user_id: string;
  merchant_id: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type Notification = {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  url: string | null;
  dedupe_key: string | null;
  status: "unread" | "read" | string;
  read_at: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type NotificationDelivery = {
  id: string;
  notification_id: string | null;
  profile_id: string | null;
  channel: "email" | "sms";
  provider: string;
  recipient: string | null;
  status: "pending" | "sent" | "skipped" | "failed";
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DocumentStorageMigrationStatus = {
  total_documents: number;
  public_url_documents: number;
  private_path_documents: number;
};
