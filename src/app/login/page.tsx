import { Suspense } from "react";
import { Activity, ArrowRight, BadgeCheck, CheckCircle2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { requestPasswordResetAction, signInAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { brand } from "@/lib/branding";

const loginSteps = [
  "Lead captured",
  "Underwriting checked",
  "Docs routed",
  "Residuals synced",
];

const loginSignals = [
  { label: "Pipeline pulse", value: "Live", tone: "bg-[#138A72] text-white" },
  { label: "Approval queue", value: "3", tone: "bg-[#0E5EC9] text-white" },
  { label: "Tasks staged", value: "18", tone: "bg-[#E9D7A1] text-[#0B0F15]" },
];

const loginActivity = [
  { title: "Sierra Coffee", detail: "Voided check requested", progress: "72%" },
  { title: "Riverside Pizza", detail: "Pricing review cleared", progress: "91%" },
  { title: "Northline Dental", detail: "Signature packet ready", progress: "64%" },
];

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
    <main className="crm-auth-shell crm-shell-bg crm-animated-bg flex min-h-screen items-center overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_0.82fr]">
        <section className="crm-login-panel order-2 rounded-[36px] border border-white/70 bg-white/38 p-5 shadow-[0_30px_90px_rgba(11,15,21,0.12)] backdrop-blur-2xl sm:p-6 lg:order-1">
          <div className="crm-enter crm-motion-delay-1 inline-flex items-center gap-2 rounded-full border border-[#0E5EC9]/15 bg-white/70 px-3 py-2 text-xs font-black uppercase text-[#0E5EC9] shadow-sm">
            <Activity className="h-4 w-4" />
            Command center online
          </div>

          <div className="crm-enter crm-motion-delay-2 mt-7 max-w-2xl">
            <h1 className="text-4xl font-black leading-none text-[#0B0F15] sm:text-5xl">
              Welcome back to {brand.productName}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#25425E]">
              Your merchant pipeline, underwriting desk, documents, residuals, and Copilot queue are warming up for the day.
            </p>
          </div>

          <div className="crm-auth-flow crm-enter crm-motion-delay-3 mt-7">
            {loginSteps.map((step, index) => (
              <div key={step} className="crm-auth-step">
                <span className="crm-auth-step-dot">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                <span>{step}</span>
                {index < loginSteps.length - 1 ? <span className="crm-auth-step-line" aria-hidden="true" /> : null}
              </div>
            ))}
          </div>

          <div className="crm-login-console crm-enter crm-motion-delay-4 mt-7 overflow-hidden rounded-[28px] border border-[#0B0F15]/10 bg-[#0B0F15] text-white shadow-[0_28px_80px_rgba(11,15,21,0.24)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="crm-live-dot" />
                <p className="text-sm font-black">Today&apos;s desk</p>
              </div>
              <ShieldCheck className="h-4 w-4 text-[#E9D7A1]" />
            </div>
            <div className="grid gap-3 p-4">
              {loginActivity.map((item, index) => (
                <div key={item.title} className={`crm-login-activity crm-motion-delay-${index + 5}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="text-xs text-white/60">{item.detail}</p>
                    </div>
                    <BadgeCheck className="h-4 w-4 text-[#E9D7A1]" />
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <span className="crm-login-progress block h-full rounded-full bg-[#E9D7A1]" style={{ width: item.progress }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="crm-login-signals crm-stagger mt-4 grid gap-3 sm:grid-cols-3">
            {loginSignals.map((signal) => (
              <div key={signal.label} className="rounded-[24px] border border-white/70 bg-white/55 p-4 shadow-sm backdrop-blur">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${signal.tone}`}>{signal.value}</span>
                <p className="mt-3 text-sm font-bold text-[#0B0F15]">{signal.label}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="crm-login-card order-1 w-full rounded-[34px] lg:order-2">
          <CardHeader className="p-5 sm:p-6">
            <BrandLogo className="crm-enter crm-motion-delay-1 mb-5 h-auto w-48 object-contain" priority />
            <div className="crm-enter crm-motion-delay-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <LockKeyhole className="h-5 w-5 text-[#0E5EC9]" />
                Sign in to {brand.companyName}
              </CardTitle>
              <CardDescription>Use your company-issued agent or manager account.</CardDescription>
            </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <form action={signInAction} className="space-y-4">
            <div className="crm-login-item crm-motion-delay-3 space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
            </div>
            <div className="crm-login-item crm-motion-delay-4 space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {params.error ? (
              <p className="crm-login-item crm-motion-delay-5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {params.error}
              </p>
            ) : null}
            {params.message ? (
              <p className="crm-login-item crm-motion-delay-5 rounded-2xl border border-[#0E5EC9]/20 bg-white/60 p-3 text-sm text-[#25425E]">
                {params.message}
              </p>
            ) : null}
            <Button className="crm-login-item crm-motion-delay-6 crm-login-primary w-full rounded-full" type="submit">
              Sign In
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <form action={requestPasswordResetAction} className="crm-login-item crm-motion-delay-7 mt-6 space-y-3 border-t border-white/55 pt-5">
            <div className="space-y-1.5">
              <Label htmlFor="reset_email">Forgot password?</Label>
              <Input id="reset_email" name="email" type="email" autoComplete="email" placeholder="Enter your email" required />
            </div>
            <Button className="w-full rounded-full" type="submit" variant="secondary">
              <Sparkles className="h-4 w-4" />
              Send Password Reset Link
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
    </main>
  );
}
