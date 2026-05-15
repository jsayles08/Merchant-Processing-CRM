import { BrandLogo } from "@/components/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { brand } from "@/lib/branding";

export default function SetupPage() {
  return (
    <main className="crm-shell-bg flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <BrandLogo className="mb-4 h-auto w-52 object-contain" priority />
          <CardTitle>Connect {brand.companyName}</CardTitle>
          <CardDescription>The app is ready for real Supabase and OpenAI credentials.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
          <p>Create `.env.local` from `.env.example`, then add your production values.</p>
          <pre className="overflow-x-auto rounded-2xl bg-black p-4 text-xs text-slate-100">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4
CRON_SECRET=
MERCHANTDESK_API_KEY=
INTEGRATION_ENCRYPTION_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
GUSTO_API_KEY=
FISERV_OAUTH_AUTHORIZATION_URL=https://accounts.cardconnect.com/auth/realms/cardconnect/protocol/openid-connect/auth
FISERV_OAUTH_CLIENT_ID=
FISERV_OAUTH_CLIENT_SECRET=
FISERV_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/oauth/fiserv/callback
NUVEI_OAUTH_CLIENT_ID=
NUVEI_OAUTH_CLIENT_SECRET=
NUVEI_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/oauth/nuvei/callback
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_COMPANY_NAME=${brand.companyName}
NEXT_PUBLIC_PRODUCT_NAME=${brand.productName}
NEXT_PUBLIC_COMPANY_INITIALS=${brand.initials}
NEXT_PUBLIC_SUPPORT_EMAIL=${brand.supportEmail}`}
          </pre>
          <p>
            After the environment is configured, run `supabase/schema.sql`, `supabase/rls.sql`, and
            `supabase/seed.sql`, then create agent profiles mapped to authenticated users.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
