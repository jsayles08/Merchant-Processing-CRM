# MR CRM

Production-minded merchant processing CRM for agents, managers, and admins to manage merchant acquisition, onboarding, residual tracking, team growth, and AI-assisted follow-up. The visible brand can be configured per company through public environment variables.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, Storage, and RLS
- OpenAI API for Agent Copilot
- Recharts dashboards
- TanStack Table merchant book
- dnd-kit pipeline foundation

## Implemented

- Protected Supabase auth flow with role-backed profiles
- Password reset and recovery flow through Supabase Auth
- Server-rendered CRM data behind Supabase RLS
- Dashboard with volume, residual, payout, forecast, agent, and recommendation cards
- Merchant CRUD workflow with Supabase server actions and pricing-floor flags
- Merchant detail routes with update timelines, automatic follow-up task creation, and document upload
- Kanban-style pipeline board with persisted stage changes
- Manager/admin pricing approval queue
- Compensation utilities for 40% personal residual, recruit activation, team override cap, monthly income, and annualized estimate
- Agent Copilot with persisted messages/actions and confirmation endpoint for major writes
- Weekly performance summary job endpoint and database function
- Production health endpoint at `/api/health`
- GitHub Actions CI for lint/build
- App-level loading, not-found, and error boundaries
- Notifications table foundation
- Dark/light mode-ready visual system

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The production app requires Supabase environment variables. Without them, it redirects to `/setup`.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_COMPANY_NAME=
NEXT_PUBLIC_PRODUCT_NAME=
NEXT_PUBLIC_COMPANY_INITIALS=
NEXT_PUBLIC_SUPPORT_EMAIL=
```

`OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only and must never be exposed in client components.

## Supabase Setup

Run these files in order in Supabase SQL editor or through the CLI:

```bash
supabase/schema.sql
supabase/rls.sql
supabase/seed.sql
```

The schema includes:

- `profiles`, `agents`, `merchants`, `merchant_updates`, `deals`, `tasks`, `documents`
- `residuals`, `teams`, `team_members`, `compensation_rules`
- `copilot_messages`, `copilot_actions`
- `agent_performance_summaries`, `notifications`
- public Supabase Storage bucket `merchant-documents`

Automation triggers include:

- pricing approvals when proposed rate is below the rule floor
- merchant/deal `updated_at`
- follow-up task creation from merchant updates
- recruit active status refresh when merchant verification changes

## Auth And Roles

This app intentionally does not offer open self-signup. Create users in Supabase Auth, then attach them to `profiles.user_id` with one of these roles:

- `admin`
- `manager`
- `agent`

Agents must also have a matching `agents.profile_id` record before they can own merchants or create merchant updates.

## Copilot Confirmation

`/api/copilot` persists every user and assistant message to Supabase. Suggested write actions are stored in `copilot_actions` with `requires_confirmation`.

Confirmed actions are applied through:

```bash
POST /api/copilot/actions/:id/confirm
```

Currently supported confirmed writes:

- create task
- add merchant timeline update
- update merchant/deal stage

## Weekly Summary Job

The secured route below calls the Postgres summary function and creates notifications:

```bash
POST /api/jobs/weekly-summary
Authorization: Bearer $CRON_SECRET
```

Use Vercel Cron, Supabase scheduled functions, GitHub Actions, or another scheduler to call it weekly.

## Health Check

Use the health endpoint for uptime checks and deployment verification:

```bash
GET /api/health
```

It returns a masked environment report and validates Supabase service-role database access. It returns `503` if required production configuration is missing or the database is unavailable.

## CI

GitHub Actions runs on pushes and pull requests to `main`:

```bash
npm ci
npm run lint
npm run build
```

See `.github/workflows/ci.yml`.

## Production Checklist

See `docs/production-readiness.md` for the operator checklist, credential rotation notes, and next product hardening work.

## Credentials Needed For Live Connection

When you are ready to connect the real services, I need:

- Supabase project URL
- Supabase anon public key
- Supabase service role key
- OpenAI API key
- Preferred production app URL
- A long random `CRON_SECRET`
- The first admin user's Supabase Auth email or user ID so we can attach the admin profile

## Compensation Rules

- Agents earn 40% of net residual on personally signed merchants
- Proposed processing rate below 1.50% requires management approval
- A recruit is active after 2 verified merchants process for 90+ days
- Each active direct recruit adds 0.25% override
- Team override caps at 1.00% per team
- Teams are the agent plus 4 direct recruits
- Overrides are one level deep and never reduce the recruited agent's 40% residual
