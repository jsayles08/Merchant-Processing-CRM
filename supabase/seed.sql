insert into profiles (id, user_id, full_name, email, role, phone, status, manager_id)
values
  ('00000000-0000-0000-0000-000000000001', null, 'Maya Chen', 'maya@cvest.example', 'admin', '(716) 555-0110', 'active', null),
  ('00000000-0000-0000-0000-000000000002', null, 'Andre Blake', 'andre@cvest.example', 'manager', '(716) 555-0111', 'active', null),
  ('00000000-0000-0000-0000-000000000003', null, 'Jordan Ellis', 'jordan@cvest.example', 'agent', '(716) 555-0112', 'active', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000004', null, 'Priya Singh', 'priya@cvest.example', 'agent', '(716) 555-0113', 'active', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000005', null, 'Marcus Reed', 'marcus@cvest.example', 'agent', '(716) 555-0114', 'active', '00000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into agents (id, profile_id, agent_code, sponsor_agent_id, team_number, team_position, status, start_date)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'CV-JE-001', null, 1, 1, 'active', '2025-01-05'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'CV-PS-002', '10000000-0000-0000-0000-000000000001', 1, 2, 'active', '2025-07-18'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'CV-MR-003', '10000000-0000-0000-0000-000000000001', 1, 3, 'ramping', '2026-02-14')
on conflict (id) do nothing;

insert into merchants (
  id,
  business_name,
  contact_name,
  contact_email,
  contact_phone,
  business_address,
  industry,
  monthly_volume_estimate,
  average_ticket,
  current_processor,
  proposed_rate,
  status,
  assigned_agent_id,
  processing_start_date,
  is_verified,
  notes
)
values
  ('20000000-0000-0000-0000-000000000001', 'Joe''s Pizza Works', 'Mike Romano', 'mike@joespizza.example', '(716) 555-0191', '210 Elmwood Ave, Buffalo, NY', 'Restaurant', 45000, 28, 'Fiserv', 1.72, 'qualified', '10000000-0000-0000-0000-000000000001', null, false, 'Owner wants transparent pricing and fast deposit timing.'),
  ('20000000-0000-0000-0000-000000000002', 'Buffalo Auto Detail', 'Sarah Mills', 'sarah@buffaloauto.example', '(716) 555-0139', '88 Seneca St, Buffalo, NY', 'Auto Services', 62000, 185, 'Square', 1.44, 'underwriting', '10000000-0000-0000-0000-000000000001', null, false, 'High-value deal below floor. Manager review required.'),
  ('20000000-0000-0000-0000-000000000003', 'Queen City Dental', 'Dr. Alicia Warren', 'ops@qcdental.example', '(716) 555-0188', '1120 Delaware Ave, Buffalo, NY', 'Healthcare', 128000, 420, 'Elavon', 1.86, 'processing', '10000000-0000-0000-0000-000000000001', '2025-11-01', true, 'Stable processor, excellent residual anchor account.'),
  ('20000000-0000-0000-0000-000000000004', 'Northside Fitness', 'Tanya Bell', 'tanya@northfit.example', '(716) 555-0162', '350 Hertel Ave, Buffalo, NY', 'Fitness', 82000, 74, 'Stripe', 1.67, 'approved', '10000000-0000-0000-0000-000000000002', null, false, 'Approved, needs equipment deployment date.'),
  ('20000000-0000-0000-0000-000000000005', 'Canalside Market', 'Owen Patel', 'owen@canalsidemarket.example', '(716) 555-0134', '44 Marine Dr, Buffalo, NY', 'Retail', 94000, 52, 'Fiserv', 1.79, 'processing', '10000000-0000-0000-0000-000000000002', '2025-10-03', true, 'Eligible merchant for recruit activation.')
on conflict (id) do nothing;

insert into deals (merchant_id, agent_id, stage, proposed_rate, estimated_monthly_volume, estimated_residual, close_probability, expected_close_date)
select
  id,
  assigned_agent_id,
  status,
  proposed_rate,
  monthly_volume_estimate,
  round(monthly_volume_estimate * (proposed_rate / 100) * 0.28, 2),
  case when status = 'processing' then 100 when status = 'underwriting' then 68 else 42 end,
  '2026-05-31'
from merchants
on conflict (merchant_id) do nothing;

insert into residuals (merchant_id, agent_id, month, processing_volume, net_residual, agent_residual_amount, company_share)
values
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '2026-04-01', 126500, 2580, 1032, 1548),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '2026-04-01', 91200, 1760, 704, 1056)
on conflict (merchant_id, month) do nothing;

insert into teams (id, leader_agent_id, team_number)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1)
on conflict (leader_agent_id, team_number) do nothing;

insert into team_members (team_id, agent_id, sponsor_agent_id, active_recruit_status)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', false),
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', false)
on conflict (team_id, agent_id) do nothing;
