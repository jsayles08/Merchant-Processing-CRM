# Production Readiness

This checklist tracks the next work needed to operate MR CRM as a platform product.

## Required Before Inviting More Users

- Rotate all Supabase, OpenAI, database, and temporary user credentials that were shared during setup.
- Add production environment variables in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `CRON_SECRET`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_COMPANY_NAME`
  - `NEXT_PUBLIC_PRODUCT_NAME`
  - `NEXT_PUBLIC_COMPANY_INITIALS`
  - `NEXT_PUBLIC_SUPPORT_EMAIL`
- Confirm `/api/health` returns `200` in production.
- Configure Supabase Auth email templates and redirect URLs:
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/reset-password`
- Enable Vercel Cron or another scheduler to call:
  - `POST /api/jobs/weekly-summary`
  - header `Authorization: Bearer $CRON_SECRET`

## Next Product Work

- Replace public document URLs with signed URLs if merchant files contain sensitive data.
- Add audit logs for merchant edits, pricing approvals, user creation, and Copilot-confirmed actions.
- Add manager assignment workflows and bulk reassignment.
- Add residual import from processor reports.
- Add email/SMS notification provider for follow-up reminders.
- Add test coverage for server actions, RLS-sensitive workflows, and compensation edge cases.
- Add observability: Vercel logs, error monitoring, uptime checks, and database backups.

## Security Notes

- Never commit `.env.local`.
- Service role key must only run on the server.
- Agents should not be given admin role in Supabase.
- Rotate credentials immediately when staff leave or secrets may have been exposed.
