import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SetupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Connect CVEST CRM</CardTitle>
          <CardDescription>The app is ready for real Supabase and OpenAI credentials.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <p>Create `.env.local` from `.env.example`, then add your production values.</p>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
CRON_SECRET=`}
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
