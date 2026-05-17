import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  ClipboardCheck,
  FileSignature,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { brand } from "@/lib/branding";

const proofPoints = [
  "Pipeline automation",
  "Underwriting rules",
  "Document readiness",
  "Copilot actions",
  "Residual tracking",
  "Team oversight",
];

const featureCards = [
  {
    icon: Workflow,
    title: "Move deals from real work",
    description:
      "Advance opportunities from saved calls, emails, applications, underwriting decisions, and onboarding milestones.",
  },
  {
    icon: ClipboardCheck,
    title: "Automate underwriting",
    description:
      "Let admins define explainable approve, decline, and manual-review rules that fit your risk policy.",
  },
  {
    icon: Bot,
    title: "Turn Copilot into action",
    description:
      "Keep AI-assisted updates connected to merchant records, activity history, tasks, and audit trails.",
  },
];

const workspaceRows = [
  { label: "Lead contacted", value: "Auto-moved", tone: "bg-white text-[#101318]" },
  { label: "Documents complete", value: "92%", tone: "bg-[#e9d7a1] text-[#101318]" },
  { label: "Underwriting", value: "Review", tone: "bg-[#0e5ec9] text-white" },
];

const metrics = [
  { label: "Active merchants", value: "248", icon: UsersRound },
  { label: "Approval pipeline", value: "$1.8M", icon: BarChart3 },
  { label: "Ready packages", value: "37", icon: FileSignature },
];

export function MerchantDeskMarketingSite() {
  return (
    <main className="md-site min-h-screen overflow-hidden bg-[#f7f8f4] text-[#101318]">
      <section className="md-hero relative min-h-[92vh] px-5 py-5 sm:px-8 lg:px-10">
        <div className="md-grid-bg absolute inset-0 opacity-70" />
        <div className="absolute left-[-12rem] top-20 h-80 w-80 rounded-full bg-[#e9d7a1]/70 blur-3xl" />
        <div className="absolute right-[-10rem] top-12 h-96 w-96 rounded-full bg-[#0e5ec9]/16 blur-3xl" />
        <BrandLogo
          mark
          priority
          className="absolute right-[-7rem] top-24 h-auto w-[30rem] opacity-[0.055] sm:right-[-4rem] lg:w-[44rem]"
        />

        <nav className="relative z-10 flex items-center justify-between">
          <Link href="/" aria-label={`${brand.productName} landing page`} className="inline-flex items-center">
            <BrandLogo className="h-14 w-auto object-contain sm:h-16" priority />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#101318]/10 bg-white/70 px-4 text-sm font-bold text-[#101318] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="hidden h-10 items-center justify-center gap-2 rounded-full bg-[#101318] px-4 text-sm font-bold text-white shadow-[0_16px_30px_rgba(16,19,24,0.18)] transition hover:-translate-y-0.5 hover:bg-[#243142] sm:inline-flex"
            >
              Open CRM
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <div className="relative z-10 grid min-h-[72vh] items-center gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#101318]/10 bg-white/72 px-3 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#2f3e4d] shadow-sm backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-[#0e5ec9]" />
              Merchant services command center
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.055em] text-[#101318] sm:text-6xl lg:text-7xl">
              The CRM built for deals that actually move.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#2f3e4d] sm:text-xl">
              {brand.productName} brings sales, underwriting, onboarding, documents, residuals, and AI-assisted work
              into one controlled workspace for merchant processing teams.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#101318] px-6 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,19,24,0.2)] transition hover:-translate-y-0.5 hover:bg-[#243142]"
              >
                Sign in to MerchantDesk
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#101318]/10 bg-white/70 px-6 text-sm font-black text-[#101318] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
              >
                Request access
              </a>
            </div>
            <div className="mt-8 flex max-w-2xl flex-wrap gap-3 text-sm font-bold text-[#2f3e4d]">
              {proofPoints.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full bg-white/64 px-3 py-2 ring-1 ring-[#101318]/8">
                  <BadgeCheck className="h-4 w-4 text-[#138a72]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-h-[35rem]">
            <div className="md-hero-console absolute inset-x-0 top-4 rounded-[2rem] border border-white/18 bg-[#101318] p-4 text-white shadow-[0_32px_90px_rgba(16,19,24,0.24)] sm:p-5 lg:left-8">
              <div className="md-console rounded-[1.5rem] p-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Live workflow</p>
                    <h2 className="mt-1 text-2xl font-black">Opportunity desk</h2>
                  </div>
                  <div className="rounded-full bg-[#138a72] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em]">
                    Synced
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {workspaceRows.map((row) => (
                    <article key={row.label} className={`rounded-[1.35rem] p-4 shadow-sm ${row.tone}`}>
                      <p className="text-sm font-black">{row.label}</p>
                      <p className="mt-8 text-2xl font-black">{row.value}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-[1.08fr_0.92fr]">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-black">Underwriting rules</p>
                      <Sparkles className="h-4 w-4 text-[#e9d7a1]" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {["Volume below threshold", "Docs complete", "Risk flags clear"].map((label, index) => (
                        <div key={label} className="rounded-2xl bg-white/[0.08] p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-bold text-white/82">{label}</span>
                            <span className="text-white/48">{index === 2 ? "Review" : "Pass"}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-[#e9d7a1]"
                              style={{ width: `${86 - index * 16}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4">
                    <p className="font-black">Agent actions</p>
                    <div className="mt-4 space-y-3">
                      {["Call saved", "Stage moved", "Audit logged"].map((item) => (
                        <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/[0.08] p-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#101318]">
                            <LineChart className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-bold text-white/84">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-5 rounded-[1.75rem] border border-[#101318]/10 bg-white/80 p-4 shadow-[0_20px_60px_rgba(16,19,24,0.14)] backdrop-blur sm:right-auto sm:w-[22rem]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#101318] text-white">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black">Access stays controlled</p>
                  <p className="text-sm leading-5 text-[#2f3e4d]">Only invited users can enter the private CRM.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-10 sm:px-8 lg:px-10">
        <div className="overflow-hidden rounded-[2rem] border border-[#101318]/10 bg-white/70 py-4 shadow-sm">
          <div className="md-marquee flex w-max gap-3 px-3">
            {[...proofPoints, ...proofPoints].map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="inline-flex items-center rounded-full bg-[#101318] px-5 py-2 text-sm font-black text-white"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-[2rem] border border-[#101318]/10 bg-white/78 p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101318] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-black tracking-[-0.02em]">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#2f3e4d]">{feature.description}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 rounded-[2rem] border border-[#101318]/10 bg-[#101318] p-4 text-white shadow-[0_22px_70px_rgba(16,19,24,0.18)] lg:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.label} className="rounded-[1.5rem] bg-white/[0.07] p-5">
                <Icon className="h-5 w-5 text-[#e9d7a1]" />
                <p className="mt-6 text-3xl font-black">{metric.value}</p>
                <p className="mt-1 text-sm font-bold text-white/58">{metric.label}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
