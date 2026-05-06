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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
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
              <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                {params.error}
              </p>
            ) : null}
            {params.message ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                {params.message}
              </p>
            ) : null}
            <Button className="w-full" type="submit">
              Sign In
            </Button>
          </form>
          <form action={requestPasswordResetAction} className="mt-6 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="space-y-1.5">
              <Label htmlFor="reset_email">Forgot password?</Label>
              <Input id="reset_email" name="email" type="email" autoComplete="email" placeholder="Enter your email" required />
            </div>
            <Button className="w-full" type="submit" variant="secondary">
              Send Password Reset Link
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
