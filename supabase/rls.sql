alter table profiles enable row level security;
alter table agents enable row level security;
alter table merchants enable row level security;
alter table merchant_updates enable row level security;
alter table deals enable row level security;
alter table tasks enable row level security;
alter table documents enable row level security;
alter table agent_recruits enable row level security;
alter table agent_recruit_updates enable row level security;
alter table agent_onboarding_records enable row level security;
alter table agent_onboarding_steps enable row level security;
alter table merchant_onboarding_records enable row level security;
alter table merchant_onboarding_steps enable row level security;
alter table signature_requests enable row level security;
alter table residuals enable row level security;
alter table residual_import_batches enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table compensation_rules enable row level security;
alter table role_permissions enable row level security;
alter table enterprise_settings enable row level security;
alter table copilot_messages enable row level security;
alter table copilot_actions enable row level security;
alter table agent_performance_summaries enable row level security;
alter table notifications enable row level security;
alter table notification_deliveries enable row level security;
alter table audit_logs enable row level security;

create or replace function current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where user_id = auth.uid();
$$;

create or replace function current_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from agents where profile_id = current_profile_id();
$$;

create or replace function current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where user_id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_app_role() = 'admin';
$$;

create or replace function is_manager_for(agent_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles agent_profile
    where agent_profile.id = agent_profile_id
      and agent_profile.manager_id = current_profile_id()
  );
$$;

revoke execute on function current_profile_id() from public, anon;
revoke execute on function current_agent_id() from public, anon;
revoke execute on function current_app_role() from public, anon;
revoke execute on function is_admin() from public, anon;
revoke execute on function is_manager_for(uuid) from public, anon;

grant execute on function current_profile_id() to authenticated;
grant execute on function current_agent_id() to authenticated;
grant execute on function current_app_role() to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function is_manager_for(uuid) to authenticated;
grant execute on function current_profile_id() to service_role;
grant execute on function current_agent_id() to service_role;
grant execute on function current_app_role() to service_role;
grant execute on function is_admin() to service_role;
grant execute on function is_manager_for(uuid) to service_role;

drop policy if exists "profiles visible by role" on profiles;
create policy "profiles visible by role"
on profiles for select
using (
  is_admin()
  or id = current_profile_id()
  or manager_id = current_profile_id()
);

drop policy if exists "admins manage profiles" on profiles;
create policy "admins manage profiles"
on profiles for all
using (is_admin())
with check (is_admin());

drop policy if exists "agents visible by role" on agents;
create policy "agents visible by role"
on agents for select
using (
  is_admin()
  or profile_id = current_profile_id()
  or is_manager_for(profile_id)
  or sponsor_agent_id = current_agent_id()
);

drop policy if exists "admins manage agents" on agents;
create policy "admins manage agents"
on agents for all
using (is_admin())
with check (is_admin());

drop policy if exists "merchants visible by ownership" on merchants;
create policy "merchants visible by ownership"
on merchants for select
using (
  is_admin()
  or assigned_agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = merchants.assigned_agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "agents create own merchants" on merchants;
create policy "agents create own merchants"
on merchants for insert
with check (is_admin() or assigned_agent_id = current_agent_id());

drop policy if exists "agents update own merchants managers update assigned" on merchants;
create policy "agents update own merchants managers update assigned"
on merchants for update
using (
  is_admin()
  or assigned_agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = merchants.assigned_agent_id
      and is_manager_for(a.profile_id)
  )
)
with check (
  is_admin()
  or assigned_agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = merchants.assigned_agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "managers delete assigned merchants" on merchants;
create policy "managers delete assigned merchants"
on merchants for delete
using (
  is_admin()
  or exists (
    select 1
    from agents a
    where a.id = merchants.assigned_agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "merchant updates visible by merchant access" on merchant_updates;
create policy "merchant updates visible by merchant access"
on merchant_updates for select
using (
  is_admin()
  or agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = merchant_updates.agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "agents create merchant updates" on merchant_updates;
create policy "agents create merchant updates"
on merchant_updates for insert
with check (is_admin() or agent_id = current_agent_id());

drop policy if exists "deals visible by ownership" on deals;
create policy "deals visible by ownership"
on deals for select
using (
  is_admin()
  or agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = deals.agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "deals writable by owners and managers" on deals;
create policy "deals writable by owners and managers"
on deals for all
using (
  is_admin()
  or agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = deals.agent_id
      and is_manager_for(a.profile_id)
  )
)
with check (
  is_admin()
  or agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = deals.agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "tasks visible by assignee or manager" on tasks;
create policy "tasks visible by assignee or manager"
on tasks for select
using (
  is_admin()
  or assigned_to = current_profile_id()
  or exists (
    select 1
    from profiles p
    where p.id = tasks.assigned_to
      and p.manager_id = current_profile_id()
  )
);

drop policy if exists "tasks writable by assignee or admin" on tasks;
drop policy if exists "tasks writable by assignee manager or admin" on tasks;
create policy "tasks writable by assignee manager or admin"
on tasks for all
using (
  is_admin()
  or assigned_to = current_profile_id()
  or exists (
    select 1
    from profiles p
    where p.id = tasks.assigned_to
      and p.manager_id = current_profile_id()
  )
)
with check (
  is_admin()
  or assigned_to = current_profile_id()
  or exists (
    select 1
    from profiles p
    where p.id = tasks.assigned_to
      and p.manager_id = current_profile_id()
  )
);

drop policy if exists "documents visible through merchant" on documents;
create policy "documents visible through merchant"
on documents for select
using (
  is_admin()
  or uploaded_by = current_profile_id()
  or exists (
    select 1
    from merchants m
    where m.id = documents.merchant_id
      and m.assigned_agent_id = current_agent_id()
  )
);

drop policy if exists "documents insert by uploader" on documents;
create policy "documents insert by uploader"
on documents for insert
with check (is_admin() or uploaded_by = current_profile_id());

drop policy if exists "agent recruits visible by recruiter" on agent_recruits;
create policy "agent recruits visible by recruiter"
on agent_recruits for select
using (
  is_admin()
  or created_by = current_profile_id()
  or assigned_recruiter_id = current_profile_id()
  or exists (
    select 1
    from profiles p
    where p.id = agent_recruits.assigned_recruiter_id
      and p.manager_id = current_profile_id()
  )
);

drop policy if exists "agent recruits writable by recruiter" on agent_recruits;
create policy "agent recruits writable by recruiter"
on agent_recruits for all
using (
  is_admin()
  or created_by = current_profile_id()
  or assigned_recruiter_id = current_profile_id()
  or exists (
    select 1
    from profiles p
    where p.id = agent_recruits.assigned_recruiter_id
      and p.manager_id = current_profile_id()
  )
)
with check (
  is_admin()
  or created_by = current_profile_id()
  or assigned_recruiter_id = current_profile_id()
  or exists (
    select 1
    from profiles p
    where p.id = agent_recruits.assigned_recruiter_id
      and p.manager_id = current_profile_id()
  )
);

drop policy if exists "agent recruit updates visible by recruit access" on agent_recruit_updates;
create policy "agent recruit updates visible by recruit access"
on agent_recruit_updates for select
using (
  is_admin()
  or author_profile_id = current_profile_id()
  or exists (
    select 1
    from agent_recruits r
    where r.id = agent_recruit_updates.recruit_id
      and (
        r.created_by = current_profile_id()
        or r.assigned_recruiter_id = current_profile_id()
        or exists (
          select 1
          from profiles p
          where p.id = r.assigned_recruiter_id
            and p.manager_id = current_profile_id()
        )
      )
  )
);

drop policy if exists "agent recruit updates writable by recruit access" on agent_recruit_updates;
create policy "agent recruit updates writable by recruit access"
on agent_recruit_updates for all
using (
  is_admin()
  or author_profile_id = current_profile_id()
  or exists (
    select 1
    from agent_recruits r
    where r.id = agent_recruit_updates.recruit_id
      and (r.created_by = current_profile_id() or r.assigned_recruiter_id = current_profile_id())
  )
)
with check (
  is_admin()
  or author_profile_id = current_profile_id()
  or exists (
    select 1
    from agent_recruits r
    where r.id = agent_recruit_updates.recruit_id
      and (r.created_by = current_profile_id() or r.assigned_recruiter_id = current_profile_id())
  )
);

drop policy if exists "agent onboarding visible by role" on agent_onboarding_records;
create policy "agent onboarding visible by role"
on agent_onboarding_records for select
using (
  is_admin()
  or profile_id = current_profile_id()
  or assigned_admin_id = current_profile_id()
  or exists (
    select 1
    from profiles p
    where p.id = agent_onboarding_records.profile_id
      and p.manager_id = current_profile_id()
  )
);

drop policy if exists "agent onboarding writable by reviewers" on agent_onboarding_records;
create policy "agent onboarding writable by reviewers"
on agent_onboarding_records for all
using (
  is_admin()
  or assigned_admin_id = current_profile_id()
  or profile_id = current_profile_id()
)
with check (
  is_admin()
  or assigned_admin_id = current_profile_id()
  or profile_id = current_profile_id()
);

drop policy if exists "agent onboarding steps visible by record" on agent_onboarding_steps;
create policy "agent onboarding steps visible by record"
on agent_onboarding_steps for select
using (
  is_admin()
  or exists (
    select 1
    from agent_onboarding_records r
    where r.id = agent_onboarding_steps.onboarding_id
      and (r.profile_id = current_profile_id() or r.assigned_admin_id = current_profile_id())
  )
);

drop policy if exists "agent onboarding steps writable by record" on agent_onboarding_steps;
create policy "agent onboarding steps writable by record"
on agent_onboarding_steps for all
using (
  is_admin()
  or exists (
    select 1
    from agent_onboarding_records r
    where r.id = agent_onboarding_steps.onboarding_id
      and (r.profile_id = current_profile_id() or r.assigned_admin_id = current_profile_id())
  )
)
with check (
  is_admin()
  or exists (
    select 1
    from agent_onboarding_records r
    where r.id = agent_onboarding_steps.onboarding_id
      and (r.profile_id = current_profile_id() or r.assigned_admin_id = current_profile_id())
  )
);

drop policy if exists "merchant onboarding visible by ownership" on merchant_onboarding_records;
create policy "merchant onboarding visible by ownership"
on merchant_onboarding_records for select
using (
  is_admin()
  or assigned_agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = merchant_onboarding_records.assigned_agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "merchant onboarding writable by ownership" on merchant_onboarding_records;
create policy "merchant onboarding writable by ownership"
on merchant_onboarding_records for all
using (
  is_admin()
  or assigned_agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = merchant_onboarding_records.assigned_agent_id
      and is_manager_for(a.profile_id)
  )
)
with check (
  is_admin()
  or assigned_agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = merchant_onboarding_records.assigned_agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "merchant onboarding steps visible by record" on merchant_onboarding_steps;
create policy "merchant onboarding steps visible by record"
on merchant_onboarding_steps for select
using (
  is_admin()
  or exists (
    select 1
    from merchant_onboarding_records r
    where r.id = merchant_onboarding_steps.onboarding_id
      and (
        r.assigned_agent_id = current_agent_id()
        or exists (
          select 1
          from agents a
          where a.id = r.assigned_agent_id
            and is_manager_for(a.profile_id)
        )
      )
  )
);

drop policy if exists "merchant onboarding steps writable by record" on merchant_onboarding_steps;
create policy "merchant onboarding steps writable by record"
on merchant_onboarding_steps for all
using (
  is_admin()
  or exists (
    select 1
    from merchant_onboarding_records r
    where r.id = merchant_onboarding_steps.onboarding_id
      and r.assigned_agent_id = current_agent_id()
  )
)
with check (
  is_admin()
  or exists (
    select 1
    from merchant_onboarding_records r
    where r.id = merchant_onboarding_steps.onboarding_id
      and r.assigned_agent_id = current_agent_id()
  )
);

drop policy if exists "signature requests visible by participant" on signature_requests;
create policy "signature requests visible by participant"
on signature_requests for select
using (
  is_admin()
  or created_by = current_profile_id()
  or recipient_profile_id = current_profile_id()
  or (
    related_entity_type = 'merchant'
    and exists (
      select 1
      from merchants m
      where m.id = signature_requests.related_entity_id
        and (
          m.assigned_agent_id = current_agent_id()
          or exists (
            select 1
            from agents a
            where a.id = m.assigned_agent_id
              and is_manager_for(a.profile_id)
          )
        )
    )
  )
);

drop policy if exists "signature requests writable by participant" on signature_requests;
create policy "signature requests writable by participant"
on signature_requests for all
using (
  is_admin()
  or created_by = current_profile_id()
  or recipient_profile_id = current_profile_id()
)
with check (
  is_admin()
  or created_by = current_profile_id()
  or recipient_profile_id = current_profile_id()
);

drop policy if exists "residuals visible by agent or manager" on residuals;
create policy "residuals visible by agent or manager"
on residuals for select
using (
  is_admin()
  or agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = residuals.agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "admin manages residuals" on residuals;
create policy "admin manages residuals"
on residuals for all
using (is_admin())
with check (is_admin());

drop policy if exists "admin manages residual imports" on residual_import_batches;
create policy "admin manages residual imports"
on residual_import_batches for all
using (is_admin())
with check (is_admin());

drop policy if exists "teams visible by leader sponsor or manager" on teams;
create policy "teams visible by leader sponsor or manager"
on teams for select
using (
  is_admin()
  or leader_agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = teams.leader_agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "team members visible by sponsor" on team_members;
create policy "team members visible by sponsor"
on team_members for select
using (
  is_admin()
  or sponsor_agent_id = current_agent_id()
  or agent_id = current_agent_id()
);

drop policy if exists "admin manages teams" on teams;
create policy "admin manages teams"
on teams for all
using (is_admin())
with check (is_admin());

drop policy if exists "admin manages team members" on team_members;
create policy "admin manages team members"
on team_members for all
using (is_admin())
with check (is_admin());

drop policy if exists "compensation rules readable" on compensation_rules;
create policy "compensation rules readable"
on compensation_rules for select
using (auth.uid() is not null);

drop policy if exists "admin manages compensation rules" on compensation_rules;
create policy "admin manages compensation rules"
on compensation_rules for all
using (is_admin())
with check (is_admin());

drop policy if exists "role permissions readable by authenticated" on role_permissions;
create policy "role permissions readable by authenticated"
on role_permissions for select
using (auth.uid() is not null);

drop policy if exists "admin manages role permissions" on role_permissions;
create policy "admin manages role permissions"
on role_permissions for all
using (is_admin())
with check (is_admin());

drop policy if exists "enterprise settings readable by authenticated" on enterprise_settings;
create policy "enterprise settings readable by authenticated"
on enterprise_settings for select
using (auth.uid() is not null);

drop policy if exists "admin manages enterprise settings" on enterprise_settings;
create policy "admin manages enterprise settings"
on enterprise_settings for all
using (is_admin())
with check (is_admin());

drop policy if exists "copilot messages own user" on copilot_messages;
create policy "copilot messages own user"
on copilot_messages for all
using (user_id = auth.uid() or is_admin())
with check (user_id = auth.uid() or is_admin());

drop policy if exists "copilot actions own user" on copilot_actions;
create policy "copilot actions own user"
on copilot_actions for all
using (user_id = auth.uid() or is_admin())
with check (user_id = auth.uid() or is_admin());

drop policy if exists "weekly summaries visible by agent or manager" on agent_performance_summaries;
create policy "weekly summaries visible by agent or manager"
on agent_performance_summaries for select
using (
  is_admin()
  or agent_id = current_agent_id()
  or exists (
    select 1
    from agents a
    where a.id = agent_performance_summaries.agent_id
      and is_manager_for(a.profile_id)
  )
);

drop policy if exists "admin manages weekly summaries" on agent_performance_summaries;
create policy "admin manages weekly summaries"
on agent_performance_summaries for all
using (is_admin())
with check (is_admin());

drop policy if exists "notifications own profile" on notifications;
create policy "notifications own profile"
on notifications for all
using (profile_id = current_profile_id() or is_admin())
with check (profile_id = current_profile_id() or is_admin());

drop policy if exists "notification deliveries visible by owner or admin" on notification_deliveries;
create policy "notification deliveries visible by owner or admin"
on notification_deliveries for select
using (profile_id = current_profile_id() or is_admin());

drop policy if exists "notification deliveries insert by authenticated" on notification_deliveries;
create policy "notification deliveries insert by authenticated"
on notification_deliveries for insert
with check (auth.uid() is not null);

drop policy if exists "audit logs visible by actor or admin" on audit_logs;
create policy "audit logs visible by actor or admin"
on audit_logs for select
using (actor_profile_id = current_profile_id() or is_admin());

drop policy if exists "audit logs insert by authenticated" on audit_logs;
create policy "audit logs insert by authenticated"
on audit_logs for insert
with check (auth.uid() is not null);

drop policy if exists "merchant documents storage read" on storage.objects;
create policy "merchant documents storage read"
on storage.objects for select
using (bucket_id = 'merchant-documents' and auth.uid() is not null);

drop policy if exists "merchant documents storage insert" on storage.objects;
create policy "merchant documents storage insert"
on storage.objects for insert
with check (bucket_id = 'merchant-documents' and auth.uid() is not null);
