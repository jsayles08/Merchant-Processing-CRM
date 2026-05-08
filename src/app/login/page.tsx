import { Suspense } from "react";
import { requestPasswordResetAction, signInAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand-logo";
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
    <main className="crm-shell-bg flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <BrandLogo className="mb-4 h-auto w-52 object-contain" priority />
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
              <p className="rounded-2xl border border-[#0E5EC9]/20 bg-white/60 p-3 text-sm text-[#25425E]">
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
