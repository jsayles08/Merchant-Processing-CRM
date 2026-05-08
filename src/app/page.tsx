import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, FileText, LockKeyhole, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { brand } from "@/lib/branding";

const featureRows = [
  { icon: UsersRound, label: "Merchant book", value: "Lead capture, profiles, assignments, and deal notes" },
  { icon: BarChart3, label: "Pipeline control", value: "Stages, approvals, residuals, reports, and weekly summaries" },
  { icon: FileText, label: "Document room", value: "Private storage paths, signed files, and migration health checks" },
];

const stageTiles = [
  { label: "New lead", color: "bg-[#0E5EC9] text-white", amount: "$47k" },
  { label: "Underwriting", color: "bg-[#E9D7A1] text-[#0B0F15]", amount: "$82k" },
  { label: "Processing", color: "bg-[#0B0F15] text-white", amount: "$126k" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F8F8F9] text-[#0B0F15]">
      <section className="relative min-h-[88vh] px-5 py-5 sm:px-8 lg:px-10">
        <div className="absolute inset-0 overflow-hidden">
          <BrandLogo
            mark
            priority
            className="absolute right-[-8rem] top-8 h-auto w-[32rem] opacity-[0.07] sm:right-[-4rem] lg:w-[44rem]"
          />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#F8F8F9] to-transparent" />
        </div>

        <nav className="relative z-10 flex items-center justify-between">
          <Link href="/" aria-label={`${brand.productName} landing page`} className="inline-flex items-center">
            <BrandLogo className="h-14 w-auto object-contain sm:h-16" priority />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#ABB7C0]/35 bg-white/70 px-4 text-sm font-semibold text-[#0B0F15] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="hidden h-10 items-center justify-center gap-2 rounded-full bg-[#0B0F15] px-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(11,15,21,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#25425E] active:translate-y-0 sm:inline-flex"
            >
              Open CRM
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <div className="relative z-10 grid min-h-[68vh] items-center gap-8 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ABB7C0]/30 bg-white/65 px-3 py-2 text-xs font-bold uppercase text-[#25425E] shadow-sm">
              <ShieldCheck className="h-4 w-4 text-[#0E5EC9]" />
              Invite-only merchant processing workspace
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.98] text-[#0B0F15] sm:text-6xl lg:text-7xl">
              MerchantDesk
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#25425E] sm:text-xl">
              A polished CRM for merchant services teams to manage clients, applications, follow-ups, residuals,
              approvals, documents, and AI-assisted daily work.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#0B0F15] px-6 text-sm font-bold text-white shadow-[0_18px_40px_rgba(11,15,21,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#25425E] active:translate-y-0"
              >
                Sign in to MerchantDesk
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#ABB7C0]/35 bg-white/65 px-6 text-sm font-bold text-[#0B0F15] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0"
              >
                Request access
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-[#25425E]">
              {["Role-based access", "Private documents", "Copilot actions", "Residual tracking"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full bg-white/58 px-3 py-2 ring-1 ring-[#ABB7C0]/24">
                  <CheckCircle2 className="h-4 w-4 text-[#0E5EC9]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-h-[33rem]">
            <div className="absolute left-8 top-0 h-24 w-24 rounded-full bg-[#E9D7A1]/80 blur-3xl" />
            <div className="absolute bottom-6 right-10 h-28 w-28 rounded-full bg-[#0E5EC9]/20 blur-3xl" />
            <div className="crm-card crm-animate-pop absolute inset-x-0 top-8 rounded-[34px] p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-[#ABB7C0]/25 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase text-[#25425E]/70">Today&apos;s workspace</p>
                  <h2 className="mt-1 text-2xl font-black">Customer Information</h2>
                </div>
                <div className="rounded-full bg-[#0B0F15] px-4 py-2 text-sm font-bold text-white">Live</div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {stageTiles.map((tile) => (
                  <div key={tile.label} className={`rounded-[24px] p-4 shadow-sm ${tile.color}`}>
                    <p className="text-sm font-bold">{tile.label}</p>
                    <p className="mt-8 text-3xl font-black">{tile.amount}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[26px] border border-[#ABB7C0]/22 bg-white/68 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">Stage funnel</p>
                    <Sparkles className="h-4 w-4 text-[#D57D25]" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {["Qualification", "Application sent", "Underwriting"].map((label, index) => (
                      <div key={label} className="rounded-full bg-[#F8F8F9] p-2">
                        <div
                          className="h-9 rounded-full bg-[#0B0F15]"
                          style={{ width: `${88 - index * 18}%`, opacity: 0.95 - index * 0.16 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[26px] border border-[#ABB7C0]/22 bg-white/68 p-4">
                  <p className="font-bold">Follow-ups</p>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {Array.from({ length: 12 }, (_, index) => (
                      <div
                        key={index}
                        className={`aspect-square rounded-2xl ${index === 2 ? "bg-[#0E5EC9]" : index === 6 ? "bg-[#E9D7A1]" : "bg-[#ABB7C0]/20"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="crm-panel crm-animate-pop absolute bottom-0 left-0 right-8 rounded-[28px] p-4 shadow-[0_18px_48px_rgba(11,15,21,0.10)] sm:right-auto sm:w-80">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B0F15] text-white">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">Access stays controlled</p>
                  <p className="text-sm text-[#25425E]/70">Share the public page. Only invited users can enter.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-10 sm:px-8 lg:px-10">
        <div className="grid gap-3 lg:grid-cols-3">
          {featureRows.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.label} className="crm-card rounded-[28px] p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B0F15] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-black">{feature.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[#25425E]/75">{feature.value}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
