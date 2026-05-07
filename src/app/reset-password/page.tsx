import { Suspense } from "react";
import { KeyRound } from "lucide-react";
import { updatePasswordAction } from "@/app/reset-password/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { brand } from "@/lib/branding";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense>
      <ResetPasswordForm searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPasswordForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <main className="crm-shell-bg flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E9D7A1] text-[#0B0F15] shadow-inner ring-1 ring-black/5">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Set a New Password</CardTitle>
          <CardDescription>Choose a new password for your {brand.productName} account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updatePasswordAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm password</Label>
              <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required />
            </div>
            {params.error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {params.error}
              </p>
            ) : null}
            <Button className="w-full rounded-full" type="submit">
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
