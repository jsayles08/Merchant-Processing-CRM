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

create table if not exists residuals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  agent_id uuid not null references agents(id),
  month date not null,
  processing_volume numeric(14,2) not null default 0,
  net_residual numeric(12,2) not null default 0,
  agent_residual_amount numeric(12,2) not null default 0,
  company_share numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (merchant_id, month)
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
  status text not null default 'unread',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger
language plpgsql
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

create or replace function sync_deal_pricing_approval()
returns trigger
language plpgsql
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

create or replace view stale_leads as
select *
from merchants
where status not in ('processing', 'lost', 'inactive')
  and updated_at < now() - interval '7 days';

create or replace view agent_monthly_income as
select
  a.id as agent_id,
  date_trunc('month', r.month)::date as month,
  sum(r.net_residual) as personal_net_residual,
  sum(r.agent_residual_amount) as personal_residual_income
from agents a
left join residuals r on r.agent_id = a.id
group by a.id, date_trunc('month', r.month);

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

insert into storage.buckets (id, name, public)
values ('merchant-documents', 'merchant-documents', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'merchant-documents';

insert into compensation_rules (rule_name)
values ('MR CRM Standard Agent Plan')
on conflict (rule_name) do nothing;
