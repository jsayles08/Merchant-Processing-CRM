# CVEST CRM

Internal CRM for CVEST agents and managers — merchant onboarding, deal pipeline,
residual tracking, team overrides, and an AI Copilot.

**Stack**: Next.js 15 (App Router) · TypeScript · Tailwind · shadcn-style UI ·
Supabase (auth + Postgres + RLS) · OpenAI · Vitest.

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in values, see below
npm run dev                     # http://localhost:3000
```

The app **runs without Supabase or OpenAI** for demo browsing — it falls back
to in-memory seed data and a stub Copilot reply. Add the env vars when you're
ready to connect real services.

### Environment variables

See `.env.example`. You need:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
  project (create one at <https://supabase.com>, then Project Settings → API).
- `SUPABASE_SERVICE_ROLE_KEY` — for admin tasks if you add them.
- `OPENAI_API_KEY` — for the Copilot route. Optional `OPENAI_MODEL`
  (default `gpt-4o-mini`).

## Database setup (Supabase)

In the Supabase SQL editor, run **in order**:

1. `supabase/schema.sql` — tables, enums, triggers.
2. `supabase/policies.sql` — row-level security.
3. `supabase/seed.sql` — demo merchants/agents/deals (optional).

The `handle_new_user` trigger auto-creates a `profiles` row when someone signs
up via Supabase Auth.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (compensation logic) |
| `npm run test:watch` | Vitest in watch mode |

## Project layout

```
app/
  (app)/                 routes that share the sidebar shell
    dashboard/           overview KPIs + recent activity
    merchants/           list, [id] detail, new/ form
    pipeline/            kanban-style deal board
    copilot/             AI chat for plain-English updates
    tasks/               follow-ups
    compensation/        residuals + override math + what-if calculator
    teams/               sponsor → recruits structure
    documents/           (stub) Supabase Storage hookup goes here
    reports/             top agents, monthly net residual
    admin/               people, comp defaults
  api/copilot/route.ts   OpenAI chat endpoint
  login/                 sign-in
components/              shadcn-style UI + app primitives
lib/
  compensation.ts        the business-critical math (with tests)
  data.ts                server-side data access (Supabase or demo)
  demo-data.ts           in-memory fallback fixtures
  supabase/{client,server,middleware}.ts
  types.ts               domain TypeScript types
supabase/
  schema.sql             tables, enums, triggers
  policies.sql           row-level security
  seed.sql               demo data
```

## Compensation rules (canonical)

These are implemented in [`lib/compensation.ts`](lib/compensation.ts) and
verified by [`lib/compensation.test.ts`](lib/compensation.test.ts):

- Each agent earns **40%** of net residual on personally signed merchants.
- Net residual is modeled as `volume × rate% × 0.30 margin` for the MVP. Plug
  in real residual statements later.
- Proposed rate **< 1.50%** auto-flags the deal for management approval. There
  is also a Postgres trigger (`tg_deal_flag_below_floor`) enforcing this on
  the database side.
- A recruit becomes **active** with **2+ verified merchants processing 90+
  consecutive days**.
- Each active recruit adds **0.25%** override, capped at **1.00% per team**.
- Teams are **sponsor + 4 direct recruits**. Excess starts a new team.
- Overrides are **one level deep** and never reduce the recruit's 40%.
- There is **no global cap** — each team computes separately.

## Demo accounts

The seed creates these (only as `profiles` rows; create the matching auth
users in Supabase Auth → Users to actually sign in):

| Email | Role |
| --- | --- |
| admin@cvest.demo | admin |
| mgr@cvest.demo | manager |
| agent1@cvest.demo … agent3@cvest.demo | agent |

## Build order — what's done vs. what's stubbed

Implemented:
- Project + config (Next 15, TS, Tailwind, shadcn primitives, theme)
- Schema + RLS + seed
- Auth flow (email/password)
- Dashboard with KPIs + recent merchants + stale leads
- Merchants CRUD: list, detail, new (with below-floor approval banner)
- Pipeline kanban (read-only — drag-and-drop is a follow-up)
- Tasks list
- Compensation page + override math + what-if calculator
- Teams page (sponsor → recruits with active/pending state)
- Reports (top agents, monthly net residual)
- Admin (people + comp defaults read-only)
- Copilot API + chat UI

Stubbed for the next pass:
- Documents page — needs a Supabase Storage bucket + upload action.
- Pipeline drag-and-drop — currently you change stage from the merchant page.
- Manager-side approval queue UI (data is there; needs a dedicated page).
- Copilot **tool calling** — current Copilot replies in plain English. Next
  iteration: pass tools (create_merchant, add_update, move_stage, create_task)
  and execute them via server actions with a confirmation step.
