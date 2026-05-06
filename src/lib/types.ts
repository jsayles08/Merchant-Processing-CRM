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

export type Residual = {
  id: string;
  merchant_id: string;
  agent_id: string;
  month: string;
  processing_volume: number;
  net_residual: number;
  agent_residual_amount: number;
  company_share: number;
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

export type CrmData = {
  profiles: Profile[];
  agents: Agent[];
  merchants: Merchant[];
  deals: Deal[];
  merchantUpdates: MerchantUpdate[];
  tasks: Task[];
  documents: Document[];
  residuals: Residual[];
  teams: Team[];
  teamMembers: TeamMember[];
  compensationRule: CompensationRule;
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
