create extension if not exists "pgcrypto";

do $$ begin
  create type app_role as enum ('admin', 'manager', 'agent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type profile_status as enum ('active', 'invited', 'inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type agent_status as enum ('active', 'ramping', 'inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type merchant_status as enum (
    'lead',
    'contacted',
    'qualified',
    'application_sent',
    'underwriting',
    'approved',
    'onboarded',
    'processing',
    'inactive',
    'lost'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type approval_status as enum ('not_required', 'pending', 'approved', 'denied');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type task_status as enum ('open', 'completed', 'overdue');
exception when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role app_role not null default 'agent',
  phone text,
  status profile_status not null default 'invited',
  manager_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  agent_code text not null unique,
  sponsor_agent_id uuid references agents(id),
  team_number integer not null default 1,
  team_position integer not null default 1,
  status agent_status not null default 'ramping',
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  constraint team_position_range check (team_position between 1 and 5)
);

create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  business_address text,
  industry text,
  monthly_volume_estimate numeric(14,2) not null default 0,
  average_ticket numeric(12,2) not null default 0,
  current_processor text,
  proposed_rate numeric(5,2) not null default 1.50,
  status merchant_status not null default 'lead',
  assigned_agent_id uuid not null references agents(id),
  processing_start_date date,
  is_verified boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists merchant_updates (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  agent_id uuid not null references agents(id),
  update_type text not null,
  note text not null,
  next_follow_up_date timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null unique references merchants(id) on delete cascade,
  agent_id uuid not null references agents(id),
  stage merchant_status not null default 'lead',
  proposed_rate numeric(5,2) not null default 1.50,
  requires_management_approval boolean not null default false,
  approval_status approval_status not null default 'not_required',
  estimated_monthly_volume numeric(14,2) not null default 0,
  estimated_residual numeric(12,2) not null default 0,
  close_probability integer not null default 25 check (close_probability between 0 and 100),
  expected_close_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid not null references profiles(id),
  merchant_id uuid references merchants(id) on delete cascade,
  due_date timestamptz not null,
  priority task_priority not null default 'medium',
  status task_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  file_name text not null,
  file_url text not null,
  document_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists agent_recruits (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null default '',
  phone text,
  source text,
  status text not null default 'new_lead' check (status in (
    'new_lead',
    'contacted',
    'interested',
    'application_started',
    'onboarding',
    'active',
    'rejected'
  )),
  assigned_recruiter_id uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_recruit_updates (
  id uuid primary key default gen_random_uuid(),
  recruit_id uuid not null references agent_recruits(id) on delete cascade,
  author_profile_id uuid references profiles(id) on delete set null,
  status text check (status in (
    'new_lead',
    'contacted',
    'interested',
    'application_started',
    'onboarding',
    'active',
    'rejected'
  )),
  note text not null,
  follow_up_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists recruit_progress (
  id uuid primary key default gen_random_uuid(),
  recruit_id uuid not null references agent_recruits(id) on delete cascade,
  team_id uuid,
  author_profile_id uuid references profiles(id) on delete set null,
  status text not null check (status in (
    'new_lead',
    'contacted',
    'interested',
    'application_started',
    'onboarding',
    'active',
    'rejected'
  )),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists agent_onboarding_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  recruit_id uuid references agent_recruits(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  assigned_admin_id uuid references profiles(id) on delete set null,
  status text not null default 'invited' check (status in (
    'invited',
    'profile_incomplete',
    'training',
    'documents_pending',
    'under_review',
    'approved',
    'active'
  )),
  profile_complete boolean not null default false,
  training_progress integer not null default 0 check (training_progress between 0 and 100),
  documents_signed boolean not null default false,
  account_activated boolean not null default false,
  admin_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references agent_onboarding_records(id) on delete cascade,
  title text not null,
  description text,
  step_order integer not null default 1,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (onboarding_id, step_order)
);

create table if not exists merchant_onboarding_records (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete set null,
  business_name text not null,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  industry text,
  processing_needs text,
  monthly_volume_estimate numeric(14,2) not null default 0,
  average_ticket numeric(12,2) not null default 0,
  current_processor text,
  status text not null default 'lead' check (status in (
    'lead',
    'contacted',
    'application_started',
    'documents_needed',
    'under_review',
    'approved',
    'active',
    'declined'
  )),
  assigned_agent_id uuid references agents(id) on delete set null,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists merchant_onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references merchant_onboarding_records(id) on delete cascade,
  title text not null,
  description text,
  step_order integer not null default 1,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (onboarding_id, step_order)
);

create table if not exists signature_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  recipient_name text not null,
  recipient_email text not null,
  recipient_profile_id uuid references profiles(id) on delete set null,
  related_entity_type text not null check (related_entity_type in ('agent', 'recruit', 'merchant', 'account')),
  related_entity_id uuid,
  document_id uuid references documents(id) on delete set null,
  provider text not null default 'manual',
  provider_request_id text,
  signing_url text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'signed', 'declined', 'expired')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists residuals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  agent_id uuid not null references agents(id),
  month date not null,
  processing_volume numeric(14,2) not null default 0,
  net_residual numeric(12,2) not null default 0,
  agent_residual_amount numeric(12,2) not null default 0,
  company_share numeric(12,2) not null default 0,
  gross_processing_revenue numeric(12,2),
  processor_cost numeric(12,2),
  processor_pricing_setting_id uuid,
  processor_pricing_snapshot jsonb,
  calculation_locked boolean not null default false,
  recalculated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (merchant_id, month)
);

alter table residuals add column if not exists gross_processing_revenue numeric(12,2);
alter table residuals add column if not exists processor_cost numeric(12,2);
alter table residuals add column if not exists processor_pricing_setting_id uuid;
alter table residuals add column if not exists processor_pricing_snapshot jsonb;
alter table residuals add column if not exists calculation_locked boolean not null default false;
alter table residuals add column if not exists recalculated_at timestamptz;

create table if not exists residual_import_batches (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references profiles(id),
  processor_name text not null,
  statement_month date not null,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  error_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_summary text,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  leader_agent_id uuid not null references agents(id) on delete cascade,
  team_number integer not null,
  created_at timestamptz not null default now(),
  unique (leader_agent_id, team_number)
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  sponsor_agent_id uuid not null references agents(id),
  active_recruit_status boolean not null default false,
  active_status_date date,
  created_at timestamptz not null default now(),
  unique (team_id, agent_id)
);

create table if not exists compensation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null unique,
  base_residual_percentage numeric(5,2) not null default 40.00,
  minimum_processing_rate numeric(5,2) not null default 1.50,
  override_per_active_recruit numeric(5,2) not null default 0.25,
  max_override_per_team numeric(5,2) not null default 1.00,
  active_recruit_required_merchants integer not null default 2,
  active_recruit_required_processing_days integer not null default 90,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  id uuid primary key default gen_random_uuid(),
  role app_role not null,
  permission_key text not null,
  enabled boolean not null default false,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, permission_key)
);

create table if not exists enterprise_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists copilot_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists copilot_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete set null,
  action_type text not null,
  action_summary text not null,
  status text not null default 'suggested',
  payload jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table copilot_actions add column if not exists payload jsonb;
alter table copilot_actions add column if not exists confirmed_at timestamptz;

create table if not exists copilot_memories (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'company' check (scope in ('company', 'merchant', 'agent', 'user')),
  title text not null,
  content text not null,
  entity_id uuid,
  confidence numeric(4,3) not null default 0.700 check (confidence >= 0 and confidence <= 1),
  source_type text not null default 'copilot_chat',
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists processor_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  display_name text not null,
  account_identifier text not null,
  agent_profile_id uuid not null references profiles(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  auth_type text not null check (auth_type in ('oauth', 'api_key', 'merchant_credentials')),
  status text not null default 'pending' check (status in ('pending', 'connected', 'error', 'disconnected', 'syncing')),
  encrypted_credentials text,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_tested_at timestamptz,
  last_error text,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists processor_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references processor_connections(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'success', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_processed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists processor_pricing_settings (
  id uuid primary key default gen_random_uuid(),
  processor_key text not null,
  processor_name text not null,
  pricing_unit text not null check (pricing_unit in ('basis_points', 'percentage', 'flat_fee', 'basis_points_plus_flat', 'percentage_plus_flat')),
  rate_value numeric(12,4) not null default 0,
  flat_fee numeric(12,4),
  effective_at date not null default current_date,
  is_active boolean not null default true,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (processor_key, pricing_unit, effective_at)
);

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'residuals_processor_pricing_setting_id_fkey'
  ) then
    alter table residuals
      add constraint residuals_processor_pricing_setting_id_fkey
      foreign key (processor_pricing_setting_id)
      references processor_pricing_settings(id)
      on delete set null;
  end if;
end $$;

create table if not exists financial_exports (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references profiles(id) on delete set null,
  export_format text not null default 'csv' check (export_format in ('csv', 'xlsx')),
  filters jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  total_processing_volume numeric(14,2) not null default 0,
  total_gross_processing_revenue numeric(14,2) not null default 0,
  total_processor_cost numeric(12,2) not null default 0,
  total_net_residual numeric(12,2) not null default 0,
  total_agent_payout numeric(12,2) not null default 0,
  total_company_share numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table financial_exports add column if not exists total_gross_processing_revenue numeric(14,2) not null default 0;
alter table financial_exports add column if not exists total_processor_cost numeric(12,2) not null default 0;

create table if not exists payroll_exports (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references profiles(id) on delete set null,
  export_format text not null default 'csv' check (export_format in ('csv', 'xlsx')),
  filters jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  gross_commissions numeric(12,2) not null default 0,
  adjustments_total numeric(12,2) not null default 0,
  total_payout numeric(12,2) not null default 0,
  status text not null default 'generated' check (status in ('generated', 'sent', 'failed')),
  provider text,
  created_at timestamptz not null default now()
);

create table if not exists payroll_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  display_name text not null,
  account_identifier text not null,
  status text not null default 'pending' check (status in ('pending', 'connected', 'error', 'disconnected', 'syncing')),
  encrypted_credentials text,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'void')),
  effective_date date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists underwriting_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  outcome text not null check (outcome in ('approve', 'deny', 'manual_review')),
  enabled boolean not null default true,
  priority integer not null default 100,
  conditions jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists underwriting_decisions (
  id uuid primary key default gen_random_uuid(),
  merchant_onboarding_id uuid not null references merchant_onboarding_records(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete set null,
  decision text not null check (decision in ('approved', 'declined', 'manual_review')),
  triggered_rule_ids uuid[] not null default '{}',
  reasons jsonb not null default '{}'::jsonb,
  evaluated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists agent_presence (
  profile_id uuid primary key references profiles(id) on delete cascade,
  status text not null default 'offline' check (status in ('online', 'away', 'offline')),
  last_seen_at timestamptz not null default now(),
  current_path text,
  user_agent text,
  updated_at timestamptz not null default now()
);

create table if not exists agent_activity_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  actor_profile_id uuid references profiles(id) on delete set null,
  event_type text not null,
  event_source text not null default 'app',
  provider text,
  connection_id uuid references processor_connections(id) on delete set null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error', 'security')),
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists agent_performance_summaries (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  summary text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (agent_id, week_start)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  url text,
  dedupe_key text unique,
  status text not null default 'unread',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications add column if not exists dedupe_key text unique;

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references notifications(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  provider text not null,
  recipient text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_profile_id, created_at desc);
create index if not exists notification_deliveries_profile_idx on notification_deliveries (profile_id, created_at desc);
create index if not exists residual_import_batches_created_idx on residual_import_batches (created_at desc);
create index if not exists residuals_calculation_locked_idx on residuals (calculation_locked, month);
create index if not exists agent_recruits_status_idx on agent_recruits (status, updated_at desc);
create index if not exists agent_recruits_recruiter_idx on agent_recruits (assigned_recruiter_id, follow_up_at);
create index if not exists agent_recruit_updates_recruit_idx on agent_recruit_updates (recruit_id, created_at desc);
create index if not exists recruit_progress_recruit_idx on recruit_progress (recruit_id, created_at desc);
create index if not exists recruit_progress_team_idx on recruit_progress (team_id, created_at desc);
create index if not exists agent_onboarding_records_status_idx on agent_onboarding_records (status, updated_at desc);
create index if not exists agent_onboarding_steps_record_idx on agent_onboarding_steps (onboarding_id, step_order);
create index if not exists merchant_onboarding_records_status_idx on merchant_onboarding_records (status, updated_at desc);
create index if not exists merchant_onboarding_records_agent_idx on merchant_onboarding_records (assigned_agent_id, follow_up_at);
create index if not exists merchant_onboarding_steps_record_idx on merchant_onboarding_steps (onboarding_id, step_order);
create index if not exists signature_requests_status_idx on signature_requests (status, updated_at desc);
create index if not exists signature_requests_entity_idx on signature_requests (related_entity_type, related_entity_id);
create index if not exists signature_requests_recipient_idx on signature_requests (recipient_profile_id, created_at desc);
create index if not exists role_permissions_role_idx on role_permissions (role, permission_key);
create index if not exists enterprise_settings_updated_idx on enterprise_settings (updated_at desc);
create index if not exists copilot_memories_scope_idx on copilot_memories (scope, updated_at desc);
create index if not exists copilot_memories_entity_idx on copilot_memories (entity_id, updated_at desc);
create unique index if not exists copilot_memories_seed_unique_idx on copilot_memories (scope, title, source_type)
where source_type = 'seed';
create index if not exists processor_connections_agent_idx on processor_connections (agent_profile_id, status, updated_at desc);
create index if not exists processor_connections_provider_idx on processor_connections (provider, status, updated_at desc);
create index if not exists processor_sync_runs_connection_idx on processor_sync_runs (connection_id, started_at desc);
create index if not exists processor_pricing_settings_lookup_idx on processor_pricing_settings (processor_key, is_active, effective_at desc);
create index if not exists financial_exports_requested_idx on financial_exports (requested_by, created_at desc);
create index if not exists payroll_exports_requested_idx on payroll_exports (requested_by, created_at desc);
create index if not exists payroll_integrations_provider_idx on payroll_integrations (provider, status, updated_at desc);
create index if not exists payroll_adjustments_agent_idx on payroll_adjustments (agent_id, effective_date desc);
create index if not exists underwriting_rules_enabled_idx on underwriting_rules (enabled, priority);
create unique index if not exists underwriting_rules_name_unique_idx on underwriting_rules (name);
create index if not exists underwriting_decisions_record_idx on underwriting_decisions (merchant_onboarding_id, created_at desc);
create index if not exists agent_presence_status_idx on agent_presence (status, last_seen_at desc);
create index if not exists agent_activity_logs_profile_idx on agent_activity_logs (profile_id, created_at desc);
create index if not exists agent_activity_logs_actor_idx on agent_activity_logs (actor_profile_id, created_at desc);
create index if not exists agent_activity_logs_provider_idx on agent_activity_logs (provider, event_type, created_at desc);

grant select, insert, update, delete on
  agent_recruits,
  agent_recruit_updates,
  recruit_progress,
  agent_onboarding_records,
  agent_onboarding_steps,
  merchant_onboarding_records,
  merchant_onboarding_steps,
  signature_requests
to authenticated;

grant select, insert, update, delete on
  role_permissions,
  enterprise_settings,
  copilot_memories
to authenticated;

grant select, insert, update, delete on
  processor_connections,
  processor_sync_runs,
  processor_pricing_settings,
  financial_exports,
  payroll_exports,
  payroll_integrations,
  payroll_adjustments,
  underwriting_rules,
  underwriting_decisions,
  agent_presence,
  agent_activity_logs
to authenticated;

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists merchants_set_updated_at on merchants;
create trigger merchants_set_updated_at before update on merchants
for each row execute function set_updated_at();

drop trigger if exists deals_set_updated_at on deals;
create trigger deals_set_updated_at before update on deals
for each row execute function set_updated_at();

drop trigger if exists agent_recruits_set_updated_at on agent_recruits;
create trigger agent_recruits_set_updated_at before update on agent_recruits
for each row execute function set_updated_at();

drop trigger if exists agent_onboarding_records_set_updated_at on agent_onboarding_records;
create trigger agent_onboarding_records_set_updated_at before update on agent_onboarding_records
for each row execute function set_updated_at();

drop trigger if exists merchant_onboarding_records_set_updated_at on merchant_onboarding_records;
create trigger merchant_onboarding_records_set_updated_at before update on merchant_onboarding_records
for each row execute function set_updated_at();

drop trigger if exists signature_requests_set_updated_at on signature_requests;
create trigger signature_requests_set_updated_at before update on signature_requests
for each row execute function set_updated_at();

drop trigger if exists role_permissions_set_updated_at on role_permissions;
create trigger role_permissions_set_updated_at before update on role_permissions
for each row execute function set_updated_at();

drop trigger if exists enterprise_settings_set_updated_at on enterprise_settings;
create trigger enterprise_settings_set_updated_at before update on enterprise_settings
for each row execute function set_updated_at();

drop trigger if exists copilot_memories_set_updated_at on copilot_memories;
create trigger copilot_memories_set_updated_at before update on copilot_memories
for each row execute function set_updated_at();

drop trigger if exists processor_connections_set_updated_at on processor_connections;
create trigger processor_connections_set_updated_at before update on processor_connections
for each row execute function set_updated_at();

drop trigger if exists processor_pricing_settings_set_updated_at on processor_pricing_settings;
create trigger processor_pricing_settings_set_updated_at before update on processor_pricing_settings
for each row execute function set_updated_at();

drop trigger if exists payroll_integrations_set_updated_at on payroll_integrations;
create trigger payroll_integrations_set_updated_at before update on payroll_integrations
for each row execute function set_updated_at();

drop trigger if exists underwriting_rules_set_updated_at on underwriting_rules;
create trigger underwriting_rules_set_updated_at before update on underwriting_rules
for each row execute function set_updated_at();

drop trigger if exists agent_presence_set_updated_at on agent_presence;
create trigger agent_presence_set_updated_at before update on agent_presence
for each row execute function set_updated_at();

create or replace function sync_deal_pricing_approval()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  minimum_rate numeric(5,2);
begin
  select minimum_processing_rate into minimum_rate
  from compensation_rules
  order by created_at desc
  limit 1;

  minimum_rate := coalesce(minimum_rate, 1.50);
  new.requires_management_approval := new.proposed_rate < minimum_rate;

  if new.requires_management_approval and new.approval_status = 'not_required' then
    new.approval_status := 'pending';
  elsif not new.requires_management_approval then
    new.approval_status := 'not_required';
  end if;

  return new;
end;
$$;

drop trigger if exists deals_sync_pricing_approval on deals;
create trigger deals_sync_pricing_approval before insert or update of proposed_rate on deals
for each row execute function sync_deal_pricing_approval();

create or replace function create_follow_up_task_from_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  assignee_profile uuid;
begin
  if new.next_follow_up_date is null then
    return new;
  end if;

  select profile_id into assignee_profile from agents where id = new.agent_id;

  insert into tasks (title, description, assigned_to, merchant_id, due_date, priority, status)
  values ('Follow up after merchant update', new.note, assignee_profile, new.merchant_id, new.next_follow_up_date, 'medium', 'open');

  return new;
end;
$$;

drop trigger if exists merchant_updates_create_follow_up_task on merchant_updates;
create trigger merchant_updates_create_follow_up_task after insert on merchant_updates
for each row execute function create_follow_up_task_from_update();

create or replace function agent_has_active_recruit_status(recruit_agent_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  with rule as (
    select active_recruit_required_merchants, active_recruit_required_processing_days
    from compensation_rules
    order by created_at desc
    limit 1
  )
  select count(*) >= coalesce((select active_recruit_required_merchants from rule), 2)
  from merchants
  where assigned_agent_id = recruit_agent_id
    and is_verified = true
    and processing_start_date <= current_date - make_interval(days => coalesce((select active_recruit_required_processing_days from rule), 90));
$$;

create or replace function refresh_team_member_active_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update team_members
  set
    active_recruit_status = agent_has_active_recruit_status(agent_id),
    active_status_date = case
      when agent_has_active_recruit_status(agent_id) and active_status_date is null then current_date
      when not agent_has_active_recruit_status(agent_id) then null
      else active_status_date
    end
  where agent_id = new.assigned_agent_id;

  return new;
end;
$$;

drop trigger if exists merchants_refresh_team_status on merchants;
create trigger merchants_refresh_team_status after insert or update of is_verified, processing_start_date, assigned_agent_id on merchants
for each row execute function refresh_team_member_active_status();

create or replace view stale_leads
with (security_invoker = true) as
select *
from merchants
where status not in ('processing', 'lost', 'inactive')
  and updated_at < now() - interval '7 days';

create or replace view agent_monthly_income
with (security_invoker = true) as
select
  a.id as agent_id,
  date_trunc('month', r.month)::date as month,
  sum(r.net_residual) as personal_net_residual,
  sum(r.agent_residual_amount) as personal_residual_income
from agents a
left join residuals r on r.agent_id = a.id
group by a.id, date_trunc('month', r.month);

create or replace view document_storage_migration_status
with (security_invoker = true) as
select
  count(*)::integer as total_documents,
  count(*) filter (where file_url ilike 'http%' or file_url like '/%')::integer as public_url_documents,
  count(*) filter (where file_url not ilike 'http%' and file_url not like '/%')::integer as private_path_documents
from documents;

create or replace function create_weekly_agent_performance_summaries(target_week_start date default date_trunc('week', current_date)::date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into agent_performance_summaries (agent_id, week_start, week_end, summary, metrics)
  select
    a.id,
    target_week_start,
    target_week_start + 6,
    concat(
      p.full_name,
      ' managed ',
      count(distinct m.id),
      ' visible merchants, added ',
      count(distinct mu.id),
      ' updates, and has ',
      count(distinct t.id) filter (where t.status <> 'completed'),
      ' open tasks this week.'
    ),
    jsonb_build_object(
      'merchant_count', count(distinct m.id),
      'update_count', count(distinct mu.id),
      'open_task_count', count(distinct t.id) filter (where t.status <> 'completed'),
      'pipeline_volume', coalesce(sum(distinct d.estimated_monthly_volume), 0)
    )
  from agents a
  join profiles p on p.id = a.profile_id
  left join merchants m on m.assigned_agent_id = a.id
  left join merchant_updates mu on mu.agent_id = a.id
    and mu.created_at::date between target_week_start and target_week_start + 6
  left join tasks t on t.assigned_to = p.id
  left join deals d on d.agent_id = a.id and d.stage not in ('processing', 'lost', 'inactive')
  group by a.id, p.full_name
  on conflict (agent_id, week_start) do update
  set summary = excluded.summary,
      metrics = excluded.metrics,
      created_at = now();

  get diagnostics inserted_count = row_count;

  insert into notifications (profile_id, title, body, url)
  select
    a.profile_id,
    'Weekly performance summary',
    s.summary,
    '/'
  from agent_performance_summaries s
  join agents a on a.id = s.agent_id
  where s.week_start = target_week_start
  on conflict do nothing;

  return inserted_count;
end;
$$;

revoke execute on function create_weekly_agent_performance_summaries(date) from public, anon, authenticated;
grant execute on function create_weekly_agent_performance_summaries(date) to service_role;

insert into storage.buckets (id, name, public)
values ('merchant-documents', 'merchant-documents', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'merchant-documents';

insert into compensation_rules (rule_name)
values ('MerchantDesk Standard Agent Plan')
on conflict (rule_name) do nothing;

insert into enterprise_settings (setting_key, setting_value, description)
values
  ('require_mfa_for_admins', '{"enabled":true}'::jsonb, 'Require higher-privilege users to use MFA before production rollout.'),
  ('restrict_exports_to_leadership', '{"enabled":true}'::jsonb, 'Keep book exports limited to manager and admin roles.'),
  ('audit_sensitive_actions', '{"enabled":true}'::jsonb, 'Record sensitive changes for compliance review and dispute resolution.'),
  ('api_access_enabled', '{"enabled":false}'::jsonb, 'Controls whether external API integrations should be allowed.'),
  ('copilot_learning_enabled', '{"enabled":true}'::jsonb, 'Allow Copilot to retain approved non-secret company knowledge from conversations and confirmed actions.'),
  ('copilot_model', '{"model":"gpt-5.4","reasoning":"medium"}'::jsonb, 'Default OpenAI model and reasoning profile used by MerchantDesk Copilot.'),
  ('copilot_memory_export_enabled', '{"enabled":true}'::jsonb, 'Allow admins to export retained Copilot memory for portability and vendor migration.'),
  ('processor_sync_enabled', '{"enabled":true}'::jsonb, 'Allow encrypted processor/provider connections and sync runs.'),
  ('underwriting_auto_decisions_enabled', '{"enabled":true}'::jsonb, 'Allow underwriting rules to make automatic application decisions.'),
  ('team_recruit_limit', '{"limit":4}'::jsonb, 'Maximum direct recruits per team before admin override is required.'),
  ('payroll_exports_enabled', '{"enabled":true}'::jsonb, 'Allow admins to generate payroll-ready commission exports.'),
  ('session_timeout_minutes', '{"minutes":60}'::jsonb, 'Target idle session timeout used for enterprise security policy.'),
  ('data_retention_years', '{"years":7}'::jsonb, 'Default business data retention window for operations and backup policies.')
on conflict (setting_key) do nothing;

insert into copilot_memories (scope, title, content, confidence, source_type)
values (
  'company',
  'MerchantDesk underwriting readiness',
  'Before a merchant moves into underwriting, collect monthly volume, average ticket, current processor, owner contact information, statements, and pricing approval status.',
  0.900,
  'seed'
)
on conflict do nothing;

insert into underwriting_rules (name, outcome, priority, conditions)
values
  ('Deny risk flagged applications', 'deny', 10, '{"riskKeywords":["match list","terminated merchant file","fraud"]}'::jsonb),
  ('Approve complete standard applications', 'approve', 100, '{"minMonthlyVolume":10000,"minDocumentCompletionRate":0.8,"minProposedRate":1.5}'::jsonb),
  ('Manual review incomplete document packets', 'manual_review', 200, '{"maxDocumentCompletionRate":0.79}'::jsonb)
on conflict (name) do nothing;

insert into processor_pricing_settings (processor_key, processor_name, pricing_unit, rate_value, flat_fee, effective_at, is_active, notes)
values
  ('fiserv', 'Fiserv', 'basis_points', 1.5000, null, '1970-01-01', true, 'Default Fiserv processor charge. 1.5 basis points equals 0.015% of processing volume.'),
  ('nuvei', 'Nuvei', 'basis_points', 2.0000, null, '1970-01-01', true, 'Placeholder Nuvei processor charge. Update when production pricing is finalized.')
on conflict (processor_key, pricing_unit, effective_at) do nothing;
