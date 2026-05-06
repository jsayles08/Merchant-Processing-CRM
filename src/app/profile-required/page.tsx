import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfileRequiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Profile Required</CardTitle>
          <CardDescription>Your login is valid, but no CVEST role profile is attached yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Ask a CVEST admin to create a `profiles` record for your Supabase Auth user. This keeps production
          access controlled instead of allowing open self-signup.
        </CardContent>
      </Card>
    </main>
  );
}
