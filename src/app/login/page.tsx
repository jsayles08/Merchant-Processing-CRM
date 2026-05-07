import { Suspense } from "react";
import { Landmark } from "lucide-react";
import { requestPasswordResetAction, signInAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { brand } from "@/lib/branding";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  return (
    <Suspense>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(120deg,#dceeff_0%,#edf8e5_58%,#fff6df_100%)] p-6">
      <Card className="w-full max-w-md bg-white/45">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7eb31] text-slate-950 shadow-inner ring-1 ring-black/5">
            <Landmark className="h-6 w-6" />
          </div>
          <CardTitle>Sign in to {brand.companyName}</CardTitle>
          <CardDescription>Use your company-issued agent or manager account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {params.error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {params.error}
              </p>
            ) : null}
            {params.message ? (
              <p className="rounded-2xl border border-[#4f9caf]/30 bg-white/55 p-3 text-sm text-slate-700">
                {params.message}
              </p>
            ) : null}
            <Button className="w-full rounded-full" type="submit">
              Sign In
            </Button>
          </form>
          <form action={requestPasswordResetAction} className="mt-6 space-y-3 border-t border-white/55 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset_email">Forgot password?</Label>
              <Input id="reset_email" name="email" type="email" autoComplete="email" placeholder="Enter your email" required />
            </div>
            <Button className="w-full rounded-full" type="submit" variant="secondary">
              Send Password Reset Link
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
