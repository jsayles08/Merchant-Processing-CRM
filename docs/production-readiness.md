# Production Readiness

This checklist tracks the next work needed to operate MerchantDesk as a platform product.

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
- Confirm `/api/health` reports `documents.publicUrlDocuments = 0`; any higher value means existing rows still point to old public URLs instead of private Supabase storage paths.
- Configure Supabase Auth email templates and redirect URLs:
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/reset-password`
- Enable Vercel Cron or another scheduler to call:
  - `GET or POST /api/jobs/weekly-summary`
  - header `Authorization: Bearer $CRON_SECRET`
  - `vercel.json` registers the production cron for Monday at 13:00 UTC.
  - `GET or POST /api/jobs/follow-up-reminders`
  - `vercel.json` registers the reminder cron daily at 12:00 UTC.
- Optional notification providers:
  - Resend: `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`
  - Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

## Next Product Work

- Apply the latest `supabase/schema.sql` and `supabase/rls.sql` updates in Supabase before using audit logs, residual imports, reminder delivery logs, or document migration status.
- Add provider-specific email/SMS templates once Resend and Twilio production credentials are active.
- Expand tests from compensation/import parsing into authenticated server action integration tests against a seeded Supabase test project.
- Add external error monitoring and uptime checks.
- Schedule and periodically restore-test Supabase database backups.

## Observability

- Use Vercel Runtime Logs for `/api/health`, `/api/jobs/weekly-summary`, `/api/jobs/follow-up-reminders`, and Copilot routes.
- Keep `/api/health` in uptime monitoring; it verifies Supabase admin connectivity and reports document storage migration counts.
- Track `audit_logs` for sensitive business actions and `notification_deliveries` for reminder delivery outcomes.
- Review `residual_import_batches` after every processor import for rejected rows or mismatched merchant names.
- Current `npm audit` reports a moderate PostCSS advisory through Next's bundled dependency. Do not force the suggested major downgrade; monitor Next releases and upgrade when the fix is available in the current supported line.

## Security Notes

- Never commit `.env.local`.
- Service role key must only run on the server.
- Agents should not be given admin role in Supabase.
- Rotate credentials immediately when staff leave or secrets may have been exposed.
