import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfileRequiredPage() {
  return (
    <main className="crm-shell-bg flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Profile Required</CardTitle>
          <CardDescription>Your login is valid, but no MerchantDesk role profile is attached yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-slate-600">
          Ask a MerchantDesk admin to create a `profiles` record for your Supabase Auth user. This keeps production
          access controlled instead of allowing open self-signup.
        </CardContent>
      </Card>
    </main>
  );
}
