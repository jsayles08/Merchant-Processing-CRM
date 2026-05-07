import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { brand } from "@/lib/branding";

export default function SetupPage() {
  return (
    <main className="crm-shell-bg flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
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
OPENAI_MODEL=gpt-5.2
CRON_SECRET=
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
