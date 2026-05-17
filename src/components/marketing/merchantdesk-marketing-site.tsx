"use client";

import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileSignature,
  LineChart,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requestAccess, type RequestAccessResult } from "@/app/actions/request-access";
import { brand } from "@/lib/branding";

const navItems = [
  { label: "Platform", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Copilot", href: "#copilot" },
  { label: "Comp plan", href: "#compensation" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const proofPoints = [
  "Pipeline automation",
  "Underwriting rules",
  "Document readiness",
  "Copilot actions",
  "Residual tracking",
  "Team oversight",
];

const marqueeItems = [
  ...proofPoints,
  "Workflow automation",
  "Audit logging",
  "Processor integrations",
  "CPA-ready exports",
  ...proofPoints,
  "Workflow automation",
  "Audit logging",
  "Processor integrations",
  "CPA-ready exports",
];

const capabilityCards = [
  {
    icon: Workflow,
    title: "Move deals from real work",
    description:
      "Advance opportunities from saved calls, emails, applications, underwriting decisions, and onboarding milestones - not manual stage clicks.",
    details: ["Saved call -> stage advanced", "App submitted -> underwriting queue", "Docs verified -> onboarding started"],
  },
  {
    icon: ClipboardCheck,
    title: "Automate underwriting",
    description:
      "Admins define explainable approve, decline, and manual-review rules that fit your risk policy across documents, volume, ticket size, proposed rate, and risk keywords.",
    details: ["Volume below threshold -> Pass", "Docs complete -> Pass", "Risk flags clear -> Manual review"],
    featured: true,
  },
  {
    icon: Bot,
    title: "Turn Copilot into action",
    description:
      "Every AI-assisted update stays connected to merchant records, activity history, tasks, and audit trails. Suggested writes wait for your confirmation.",
    details: ["Drafts follow-up emails", "Proposes tasks and timelines", "Writes only after you confirm"],
  },
];

const metrics = [
  { label: "Active merchants", count: 248, icon: UsersRound },
  { label: "Approval pipeline", count: 1.8, prefix: "$", suffix: "M", decimals: 1, icon: BarChart3 },
  { label: "Ready packages", count: 37, icon: FileSignature },
];

const featureTabs = [
  {
    id: "opportunities",
    label: "Opportunities",
    title: "Opportunities that advance themselves",
    description:
      "Stop pushing cards. Saved calls, sent emails, completed applications, and underwriting decisions move opportunities forward automatically. Every transition is audit-logged.",
    bullets: [
      "Saved calls and emails advance the stage",
      "Forecast, weighted probability, and aging",
      "Automatic follow-up tasks from every update",
      "One-level overrides without crushing the recruit's residual",
    ],
    visual: "kanban",
  },
  {
    id: "underwriting",
    label: "Underwriting",
    title: "Explainable underwriting rules",
    description:
      "Rules stay readable. Admins can route merchants to approve, decline, or manual review with the reason recorded for every decision.",
    bullets: ["Document completeness checks", "Volume and ticket thresholds", "Risk keyword routing", "Pricing exceptions with approvals"],
    visual: "rules",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    title: "Merchant onboarding without loose ends",
    description:
      "Package readiness, signatures, processor setup, and launch milestones stay visible from the same merchant record.",
    bullets: ["Readiness score by document", "Signature packets and uploaded files", "Processor connection status", "Owner, manager, and operations handoffs"],
    visual: "timeline",
  },
  {
    id: "residuals",
    label: "Residuals",
    title: "Residuals and overrides you can explain",
    description:
      "Import residual batches, reconcile merchant income, and calculate team overrides without mystery spreadsheets.",
    bullets: ["40% personal residual model", "0.25% override per active recruit", "Team cap protection", "Paid-record safeguards"],
    visual: "ledger",
  },
  {
    id: "reports",
    label: "Reports",
    title: "CPA-ready exports and audit trails",
    description:
      "Finance and managers get scoped reports with server-side permission checks, activity receipts, and clean exports.",
    bullets: ["CPA financial export", "Payroll export", "Agent and manager scopes", "Audit log receipts"],
    visual: "reports",
  },
  {
    id: "teams",
    label: "Teams",
    title: "Built for agents, recruits, and managers",
    description:
      "Team capacity, direct recruits, active status, and manager visibility are built into the workflow instead of bolted on later.",
    bullets: ["Four direct recruits per team", "Role-aware analytics", "Manager approval queues", "Recruit status tracking"],
    visual: "teams",
  },
];

const workflowSteps = [
  {
    number: "01",
    title: "Capture and assign",
    description:
      "Drop a lead in or pipe one through the integration API. Auto-assignment, owner profiles, and merchant timelines start immediately.",
    rows: ["New lead - Riverside Pizza", "Assigned - Maya Rivera", "Timeline created"],
  },
  {
    number: "02",
    title: "Underwrite and price",
    description:
      "Move to under review and the explainable rules engine checks documents, volume, ticket size, proposed rate, and risk keywords.",
    rows: ["Docs complete", "Risk flags reviewed", "Pricing floor checked"],
  },
  {
    number: "03",
    title: "Confirm actions",
    description:
      "Copilot can draft follow-ups, create tasks, and propose updates. Writes happen after a human confirms them.",
    rows: ["Draft email", "Create task", "Add timeline note"],
  },
  {
    number: "04",
    title: "Activate and earn",
    description:
      "Onboarding, residual imports, and compensation rules stay connected after the merchant starts processing.",
    rows: ["Docs verified", "Processor linked", "First residual logged"],
  },
];

const compCards = [
  { value: "40%", title: "Personal residual", copy: "Net residual on every merchant you personally sign. No tiers, no escalators." },
  { value: "0.25%", title: "Override per recruit", copy: "Earned for each active direct recruit. Active means 2 verified merchants processing 90+ days." },
  { value: "1.00%", title: "Team override cap", copy: "Maximum per team. Overrides are one level deep and never reduce the recruit's 40%." },
  { value: "4", title: "Direct recruits per team", copy: "Configurable team capacity via team_recruit_limit. Default fits the four-recruit model." },
  { value: "1.50%", title: "Pricing approval floor", copy: "Any proposed rate below this routes to management approval with the proposed rate and reason logged." },
  { value: "All", title: "Audit trail depth", copy: "Every override, reassignment, pricing exception, and Copilot write keeps a durable receipt." },
];

const integrations = [
  { category: "Processors", name: "Fiserv / CardConnect", detail: "OAuth, sync history, encrypted credentials", status: "Live" },
  { category: "Processors", name: "Nuvei", detail: "OAuth, activity monitoring, sync runs", status: "Live" },
  { category: "Payroll", name: "Gusto", detail: "Adapter stub, manual rails today", status: "Beta" },
  { category: "Payroll", name: "Stripe", detail: "Adapter stub, payouts in progress", status: "Beta" },
  { category: "Comms", name: "Resend and Twilio", detail: "Email and SMS delivery logs for Copilot reminders", status: "Live" },
  { category: "AI", name: "OpenAI", detail: "Copilot, confirmation-first writes, memory export", status: "Live" },
];

const statCards = [
  { count: 3.8, suffix: "x", decimals: 1, label: "faster underwriting decisions vs. spreadsheets" },
  { count: 92, suffix: "%", label: "of follow-ups auto-drafted by Copilot" },
  { count: 2.4, prefix: "$", suffix: "M", decimals: 1, label: "monthly volume tracked per average team" },
  { count: 100, suffix: "%", label: "audit-logged writes for compliance" },
];

const testimonials = [
  {
    quote: "We pulled six tools into one. The Copilot follow-ups alone got our agents an hour back every day.",
    name: "Maya Rivera",
    role: "Lead Agent - West Team",
    initials: "MR",
  },
  {
    quote: "Residuals used to take three days to reconcile. Now I import the CSV, audit the batch, and pay the team in an hour.",
    name: "Dion Carter",
    role: "Operations Manager",
    initials: "DC",
  },
  {
    quote: "The audit log is the killer feature. Every pricing exception, reassignment, and Copilot write has a receipt.",
    name: "Joshua Sayles",
    role: "Founder, MerchantDesk",
    initials: "JS",
  },
];

const pricing = [
  {
    name: "Solo Agent",
    price: "$49",
    suffix: "/mo",
    description: "For independent agents running their own book.",
    features: ["Up to 250 merchants", "Pipeline, documents, residuals", "Copilot with 250 actions/mo", "Email follow-up reminders"],
  },
  {
    name: "Team",
    price: "$199",
    suffix: "/mo",
    description: "For small teams with recruits, overrides, and managers.",
    features: [
      "Unlimited merchants",
      "Manager queue and pricing approvals",
      "Workflow automation and underwriting rules",
      "Copilot with unlimited actions",
      "SMS reminders via Twilio",
      "Residual CSV import and payroll exports",
      "Up to 25 seats",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For ISOs and multi-team organizations.",
    features: ["SSO and custom roles", "Processor OAuth for Fiserv and Nuvei", "Custom underwriting rules", "SLA and dedicated success engineer", "White-label branding"],
  },
];

const faqs = [
  {
    question: "Is MerchantDesk really invite-only?",
    answer:
      "Yes. There is no open self-signup. Users are provisioned through Supabase Auth with admin, manager, or agent roles, and agents need a matching profile before they can own merchants.",
  },
  {
    question: "How do explainable underwriting rules work?",
    answer:
      "Admins configure rules for documents, volume, ticket size, proposed rate, and risk keywords. When a merchant moves to under review, MerchantDesk writes the decision and the rule that fired to the audit log.",
  },
  {
    question: "Which processors do you support?",
    answer:
      "Fiserv / CardConnect and Nuvei OAuth connections are first-class. The adapter layer keeps credentials encrypted and exposes only safe metadata to UI and logs.",
  },
  {
    question: "How exactly are residuals computed?",
    answer:
      "The default model is 40% personal residual, 0.25% override per active direct recruit, and a 1.00% team override cap. Overrides are one level deep and never reduce the recruit's 40%.",
  },
  {
    question: "Does Copilot actually write to my data?",
    answer:
      "Only after confirmation. Suggested actions persist as pending writes, then confirmed actions flow through the server route and are audit-logged.",
  },
  {
    question: "What exports are available?",
    answer:
      "CPA-ready financial CSVs live in reports, and payroll exports live in compensation. Both are permission-restricted, server-side, and audit-logged.",
  },
];

export function MerchantDeskMarketingSite() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeFeature, setActiveFeature] = useState(featureTabs[0].id);
  const [formResult, setFormResult] = useState<RequestAccessResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedFeature = featureTabs.find((feature) => feature.id === activeFeature) ?? featureTabs[0];

  useMarketingEffects(setIsScrolled);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");

    startTransition(async () => {
      const result = await requestAccess(email);
      setFormResult(result);

      if (result.ok) {
        form.reset();
      }
    });
  }

  return (
    <main className="md-site min-h-screen overflow-hidden bg-[#f7f8f4] text-[#101318]">
      <div className="md-cursor-glow" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="md-grid-bg absolute inset-0 opacity-40" />
        <div className="md-ambient absolute inset-0">
          <span className="md-blob md-blob-gold" />
          <span className="md-blob md-blob-blue" />
          <span className="md-blob md-blob-slate" />
        </div>
        <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_82%_14%,rgba(233,215,161,0.62),transparent_32%),radial-gradient(circle_at_7%_34%,rgba(14,94,201,0.16),transparent_31%)]" />
      </div>

      <AnnouncementBar />
      <header
        className={[
          "sticky top-0 z-50 border-b bg-[#f7f8f4]/86 backdrop-blur-xl transition-all duration-300",
          isScrolled ? "md-nav-scrolled border-[#101318]/10" : "border-transparent",
        ].join(" ")}
      >
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-0">
          <Link href="/" aria-label={`${brand.productName} home`} className="inline-flex items-center gap-3 font-black">
            <MerchantMark />
            <span className="text-lg tracking-[-0.02em]">{brand.productName}</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-[#2f3e4d] lg:flex" aria-label="Primary">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-[#101318]">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/login" className="md-btn md-btn-ghost">
              Sign in
            </Link>
            <a href="#demo" className="md-btn md-btn-dark">
              Request access
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#101318]/10 bg-white text-[#101318] shadow-sm lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <nav className="mx-auto grid w-full max-w-[1240px] gap-1 border-t border-[#101318]/10 px-5 py-4 sm:px-8 lg:hidden" aria-label="Mobile primary">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="rounded-lg px-2 py-3 text-sm font-bold text-[#2f3e4d]" onClick={() => setMobileOpen(false)}>
                {item.label}
              </a>
            ))}
            <Link href="/login" className="md-btn md-btn-ghost mt-2" onClick={() => setMobileOpen(false)}>
              Sign in
            </Link>
            <a href="#demo" className="md-btn md-btn-dark" onClick={() => setMobileOpen(false)}>
              Request access
            </a>
          </nav>
        ) : null}
      </header>

      <HeroSection />
      <CapabilitiesSection activeFeature={selectedFeature} setActiveFeature={setActiveFeature} />
      <WorkflowSection />
      <CopilotSection />
      <CompensationSection />
      <IntegrationsSection />
      <StatsSection />
      <TestimonialsSection />
      <PricingSection />
      <FaqSection />
      <CtaSection result={formResult} isPending={isPending} onSubmit={handleSubmit} />
      <Footer />
    </main>
  );
}

function useMarketingEffects(setIsScrolled: (value: boolean) => void) {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion) {
      document.documentElement.classList.add("md-motion-ready");
    }

    const syncScrollState = () => setIsScrolled(window.scrollY > 8);
    syncScrollState();
    window.addEventListener("scroll", syncScrollState, { passive: true });

    const revealItems = Array.from(document.querySelectorAll<HTMLElement>(".md-reveal"));
    const counterItems = Array.from(document.querySelectorAll<HTMLElement>(".md-count"));
    const typeItems = Array.from(document.querySelectorAll<HTMLElement>("[data-type]"));
    const timers: number[] = [];
    let revealObserver: IntersectionObserver | null = null;
    let counterObserver: IntersectionObserver | null = null;
    let typeObserver: IntersectionObserver | null = null;

    const formatCounter = (element: HTMLElement, value: number) => {
      const decimals = Number(element.dataset.decimals ?? 0);
      const prefix = element.dataset.prefix ?? "";
      const suffix = element.dataset.suffix ?? "";
      element.textContent = `${prefix}${value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;
    };

    const animateCounter = (element: HTMLElement) => {
      if (element.dataset.counted === "true") {
        return;
      }

      element.dataset.counted = "true";
      const target = Number(element.dataset.count ?? 0);

      if (reduceMotion) {
        formatCounter(element, target);
        return;
      }

      const duration = 1200;
      const start = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        formatCounter(element, target * eased);

        if (progress < 1) {
          window.requestAnimationFrame(tick);
        } else {
          formatCounter(element, target);
        }
      };

      formatCounter(element, 0);
      window.requestAnimationFrame(tick);
    };

    const typeText = (element: HTMLElement) => {
      if (element.dataset.typed === "true") {
        return;
      }

      element.dataset.typed = "true";
      const text = element.dataset.type ?? "";

      if (reduceMotion) {
        element.textContent = text;
        element.classList.add("is-done");
        return;
      }

      element.textContent = "";
      let index = 0;
      const timer = window.setInterval(() => {
        index += 1;
        element.textContent = text.slice(0, index);

        if (index >= text.length) {
          window.clearInterval(timer);
          element.classList.add("is-done");
        }
      }, 18);
      timers.push(timer);
    };

    if (reduceMotion) {
      revealItems.forEach((element) => element.classList.add("md-visible"));
      counterItems.forEach(animateCounter);
      typeItems.forEach(typeText);
    } else {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("md-visible");
              revealObserver?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
      );
      revealItems.forEach((element) => revealObserver?.observe(element));

      counterObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animateCounter(entry.target as HTMLElement);
              counterObserver?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.35 },
      );
      counterItems.forEach((element) => counterObserver?.observe(element));

      typeObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              typeText(entry.target as HTMLElement);
              typeObserver?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.65 },
      );
      typeItems.forEach((element) => typeObserver?.observe(element));
    }

    const cursorGlow = document.querySelector<HTMLElement>(".md-cursor-glow");
    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
    const moveGlow = (event: PointerEvent) => {
      if (!cursorGlow || reduceMotion || !supportsFinePointer) {
        return;
      }

      cursorGlow.style.setProperty("--md-glow-x", `${event.clientX}px`);
      cursorGlow.style.setProperty("--md-glow-y", `${event.clientY}px`);
      cursorGlow.classList.add("is-visible");
    };
    window.addEventListener("pointermove", moveGlow, { passive: true });

    const tiltRoot = document.querySelector<HTMLElement>("[data-tilt]");
    const tiltCard = tiltRoot?.querySelector<HTMLElement>(".md-tilt-card");
    const tilt = (event: PointerEvent) => {
      if (!tiltRoot || !tiltCard || reduceMotion || !supportsFinePointer) {
        return;
      }

      const rect = tiltRoot.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      tiltCard.style.transform = `perspective(1100px) rotateX(${y * -5}deg) rotateY(${x * 6}deg) translate3d(0,-4px,0)`;
    };
    const resetTilt = () => {
      if (tiltCard) {
        tiltCard.style.transform = "";
      }
    };
    tiltRoot?.addEventListener("pointermove", tilt);
    tiltRoot?.addEventListener("pointerleave", resetTilt);

    const kanbanColumns = Array.from(document.querySelectorAll<HTMLElement>("[data-kanban-column]"));
    const kanbanCards = Array.from(document.querySelectorAll<HTMLElement>("[data-kanban-card]"));
    const dragStart = (event: DragEvent) => {
      const card = event.currentTarget as HTMLElement;
      event.dataTransfer?.setData("text/plain", card.dataset.kanbanCard ?? "");
      card.classList.add("is-dragging");
    };
    const dragEnd = (event: DragEvent) => {
      (event.currentTarget as HTMLElement).classList.remove("is-dragging");
      kanbanColumns.forEach((column) => column.classList.remove("is-drag-over"));
    };
    const dragOver = (event: DragEvent) => {
      event.preventDefault();
      (event.currentTarget as HTMLElement).classList.add("is-drag-over");
    };
    const dragLeave = (event: DragEvent) => {
      (event.currentTarget as HTMLElement).classList.remove("is-drag-over");
    };
    const dropCard = (event: DragEvent) => {
      event.preventDefault();
      const column = event.currentTarget as HTMLElement;
      column.classList.remove("is-drag-over");
      const cardId = event.dataTransfer?.getData("text/plain");
      const card = cardId ? document.querySelector<HTMLElement>(`[data-kanban-card="${cardId}"]`) : null;
      const list = column.querySelector<HTMLElement>("[data-kanban-list]");

      if (card && list) {
        list.append(card);
      }
    };

    kanbanCards.forEach((card) => {
      card.addEventListener("dragstart", dragStart);
      card.addEventListener("dragend", dragEnd);
    });
    kanbanColumns.forEach((column) => {
      column.addEventListener("dragover", dragOver);
      column.addEventListener("dragleave", dragLeave);
      column.addEventListener("drop", dropCard);
    });

    return () => {
      window.removeEventListener("scroll", syncScrollState);
      window.removeEventListener("pointermove", moveGlow);
      document.documentElement.classList.remove("md-motion-ready");
      revealObserver?.disconnect();
      counterObserver?.disconnect();
      typeObserver?.disconnect();
      timers.forEach((timer) => window.clearInterval(timer));
      tiltRoot?.removeEventListener("pointermove", tilt);
      tiltRoot?.removeEventListener("pointerleave", resetTilt);
      kanbanCards.forEach((card) => {
        card.removeEventListener("dragstart", dragStart);
        card.removeEventListener("dragend", dragEnd);
      });
      kanbanColumns.forEach((column) => {
        column.removeEventListener("dragover", dragOver);
        column.removeEventListener("dragleave", dragLeave);
        column.removeEventListener("drop", dropCard);
      });
    };
  }, [setIsScrolled]);
}

function AnnouncementBar() {
  return (
    <div className="relative z-10 bg-[#101318] text-sm font-semibold text-white/90">
      <div className="mx-auto grid w-full max-w-[1240px] justify-items-center gap-2 overflow-hidden px-5 py-2.5 text-center text-xs sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-3 sm:px-8 sm:text-sm lg:px-0">
        <span className="hidden h-2 w-2 rounded-full bg-[#e9d7a1] shadow-[0_0_0_5px_rgba(233,215,161,0.18)] sm:block" />
        <span className="max-w-[19rem] leading-5 sm:max-w-none">Workflow automation and explainable underwriting rules are now live.</span>
        <a href="#workflow" className="inline-flex items-center gap-1 font-black text-[#e9d7a1]">
          See what shipped <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section id="top" className="relative z-10 px-5 pb-8 pt-14 sm:px-8 lg:px-10">
      <div className="mx-auto grid w-full max-w-[1240px] items-center gap-12 pb-10 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="md-reveal min-w-0 max-w-[21.5rem] sm:max-w-none">
          <div className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-full border border-[#101318]/10 bg-white/72 px-3.5 py-2 text-center text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#2f3e4d] shadow-sm backdrop-blur sm:w-auto sm:text-xs sm:tracking-[0.22em]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#0e5ec9]" />
            <span className="min-w-0">Merchant services command center</span>
          </div>
          <h1 className="mt-6 max-w-[10ch] text-4xl font-black leading-[0.95] tracking-[-0.055em] text-[#101318] sm:max-w-[12ch] sm:text-6xl lg:text-7xl">
            The CRM built for deals that <span className="font-serif italic font-normal text-[#2f3e4d]">actually move.</span>
          </h1>
          <p className="mt-6 max-w-full text-lg leading-8 text-[#2f3e4d] sm:max-w-xl">
            {brand.productName} brings sales, underwriting, onboarding, documents, residuals, and AI-assisted work into one controlled workspace for merchant processing teams.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#demo" className="md-btn md-btn-dark md-btn-lg w-full sm:w-auto">
              Request access
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#workflow" className="md-btn md-btn-ghost md-btn-lg w-full sm:w-auto">
              <Play className="h-4 w-4" />
              See the workflow
            </a>
          </div>
          <div className="mt-8 grid max-w-2xl gap-2.5 text-sm font-bold text-[#2f3e4d] sm:flex sm:flex-wrap">
            {proofPoints.map((item) => (
              <span key={item} className="inline-flex w-full items-center gap-2 rounded-full border border-[#101318]/10 bg-white/70 px-3.5 py-2 shadow-sm backdrop-blur sm:w-auto">
                <BadgeCheck className="h-4 w-4 text-[#138a72]" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <HeroConsole />
      </div>

      <div className="md-reveal mx-auto w-full max-w-[1240px] overflow-hidden rounded-[2rem] border border-[#101318]/10 bg-white/70 py-3 shadow-sm backdrop-blur">
        <div className="md-marquee flex w-max gap-3 px-3">
          {marqueeItems.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className={[
                "inline-flex items-center rounded-full px-5 py-2 text-sm font-black",
                index % 5 === 2
                  ? "bg-[#e9d7a1] text-[#101318]"
                  : index % 3 === 1
                    ? "border border-[#101318]/10 bg-white text-[#101318]"
                    : "bg-[#101318] text-white",
              ].join(" ")}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="md-reveal mx-auto mt-4 grid w-full max-w-[1240px] gap-3 rounded-[2rem] bg-[#101318] p-4 text-white shadow-[0_22px_70px_rgba(16,19,24,0.18)] lg:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="rounded-[1.4rem] bg-white/[0.07] p-5">
              <Icon className="h-5 w-5 text-[#e9d7a1]" />
              <p className="mt-5 text-4xl font-black tracking-[-0.04em]">
                <CounterValue count={metric.count} decimals={metric.decimals} prefix={metric.prefix} suffix={metric.suffix} />
              </p>
              <p className="mt-1 text-sm font-bold text-white/58">{metric.label}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HeroConsole() {
  const workspaceRows = [
    { label: "Lead contacted", value: "Auto-moved", tone: "bg-white text-[#101318]" },
    { label: "Documents complete", value: "92%", tone: "bg-[#e9d7a1] text-[#101318]" },
    { label: "Underwriting", value: "Review", tone: "bg-[#0e5ec9] text-white" },
  ];

  return (
    <div className="md-reveal relative min-h-[35rem]" data-tilt>
      <div className="md-hero-console md-tilt-card absolute inset-x-0 top-4 rounded-[2rem] border border-white/10 bg-[#101318] p-4 text-white shadow-[0_32px_90px_rgba(16,19,24,0.28)] sm:p-5 lg:left-8">
        <div className="md-console rounded-[1.5rem] p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Live workflow</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.02em]">Opportunity desk</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#138a72] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em]">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Synced
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {workspaceRows.map((row) => (
              <article key={row.label} className={`flex min-h-24 flex-col justify-between rounded-[1.25rem] p-4 shadow-sm ${row.tone}`}>
                <p className="text-sm font-black">{row.label}</p>
                <p className="mt-7 text-2xl font-black tracking-[-0.02em]">
                  {row.label === "Documents complete" ? <CounterValue count={92} suffix="%" /> : row.value}
                </p>
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
                  <div key={label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-white/82">{label}</span>
                      <span className={index === 2 ? "font-bold text-[#e9d7a1]" : "font-bold text-white/48"}>
                        {index === 2 ? "Review" : "Pass"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#e9d7a1]" style={{ width: `${86 - index * 16}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4">
              <p className="font-black">Agent actions</p>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Call saved", icon: MessageSquareText },
                  { label: "Stage moved", icon: ChevronRight },
                  { label: "Audit logged", icon: ShieldCheck },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-white/[0.08] p-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#101318]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-bold text-white/84">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-5 rounded-[1.75rem] border border-[#101318]/10 bg-white/90 p-4 shadow-[0_20px_60px_rgba(16,19,24,0.14)] backdrop-blur sm:right-auto sm:w-[22rem]">
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
  );
}

function CapabilitiesSection({
  activeFeature,
  setActiveFeature,
}: {
  activeFeature: (typeof featureTabs)[number];
  setActiveFeature: (value: string) => void;
}) {
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, featureId: string) {
    const currentIndex = featureTabs.findIndex((feature) => feature.id === featureId);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % featureTabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + featureTabs.length) % featureTabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = featureTabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextFeature = featureTabs[nextIndex];
    setActiveFeature(nextFeature.id);
    document.getElementById(`feature-tab-${nextFeature.id}`)?.focus();
  }

  return (
    <section id="features" className="relative z-10 border-y border-[#101318]/10 bg-white px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          kicker="Platform"
          title={
            <>
              Three things that make {brand.productName} <em>actually different.</em>
            </>
          }
          description="Most CRMs were built for SaaS. MerchantDesk was built around the workflow merchant services teams actually run."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {capabilityCards.map((card) => (
            <CapabilityCard key={card.title} {...card} />
          ))}
        </div>

        <div className="md-reveal mx-auto mt-24 max-w-3xl text-center">
          <p className="md-kicker">Workspace tour</p>
          <h2 className="text-4xl font-black leading-none tracking-[-0.04em] sm:text-5xl">
            Every surface, <span className="font-serif italic font-normal text-[#2f3e4d]">tuned for the desk.</span>
          </h2>
        </div>

        <div className="md-reveal mt-10 flex gap-2 overflow-x-auto rounded-full border border-[#101318]/10 bg-[#f7f8f4] p-1.5" role="tablist" aria-label="Feature areas">
          {featureTabs.map((feature) => (
            <button
              key={feature.id}
              id={`feature-tab-${feature.id}`}
              type="button"
              role="tab"
              aria-selected={activeFeature.id === feature.id}
              aria-controls="feature-panel"
              className={[
                "h-10 shrink-0 rounded-full px-4 text-sm font-black transition",
                activeFeature.id === feature.id ? "bg-[#101318] text-white shadow-sm" : "text-[#2f3e4d] hover:bg-white",
              ].join(" ")}
              onClick={() => setActiveFeature(feature.id)}
              onKeyDown={(event) => handleTabKeyDown(event, feature.id)}
            >
              {feature.label}
            </button>
          ))}
        </div>

        <div
          key={activeFeature.id}
          id="feature-panel"
          role="tabpanel"
          aria-labelledby={`feature-tab-${activeFeature.id}`}
          className="md-feature-panel mt-5 grid gap-8 rounded-[2rem] border border-[#101318]/10 bg-[#f7f8f4] p-6 shadow-sm lg:grid-cols-[0.9fr_1.1fr] lg:p-8"
        >
          <div>
            <h3 className="text-3xl font-black tracking-[-0.03em]">{activeFeature.title}</h3>
            <p className="mt-4 text-base leading-7 text-[#2f3e4d]">{activeFeature.description}</p>
            <ul className="mt-6 grid gap-3">
              {activeFeature.bullets.map((bullet) => (
                <CheckItem key={bullet}>{bullet}</CheckItem>
              ))}
            </ul>
          </div>
          <FeatureVisual kind={activeFeature.visual} />
        </div>
      </div>
    </section>
  );
}

function CapabilityCard({
  icon: Icon,
  title,
  description,
  details,
  featured,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  details: string[];
  featured?: boolean;
}) {
  return (
    <article
      className={[
        "md-reveal rounded-[2rem] border p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl",
        featured ? "border-[#101318] bg-[#101318] text-white shadow-[0_32px_80px_rgba(16,19,24,0.22)]" : "border-[#101318]/10 bg-[#f7f8f4]",
      ].join(" ")}
    >
      <div className={featured ? "flex h-13 w-13 items-center justify-center rounded-2xl bg-[#e9d7a1] text-[#101318]" : "flex h-13 w-13 items-center justify-center rounded-2xl bg-[#101318] text-white"}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-6 text-2xl font-black tracking-[-0.03em]">{title}</h3>
      <p className={featured ? "mt-3 leading-7 text-white/72" : "mt-3 leading-7 text-[#2f3e4d]"}>{description}</p>
      <div className={featured ? "mt-6 grid gap-2 rounded-2xl bg-white/[0.08] p-4" : "mt-6 grid gap-2 rounded-2xl bg-white p-4"}>
        {details.map((detail) => (
          <div key={detail} className="flex items-center gap-2 text-sm font-bold">
            <span className="h-2 w-2 rounded-full bg-[#e9d7a1]" />
            {detail}
          </div>
        ))}
      </div>
    </article>
  );
}

function FeatureVisual({ kind }: { kind: string }) {
  if (kind === "kanban") {
    return (
      <div className="grid gap-3 rounded-[1.5rem] bg-white p-4 shadow-sm sm:grid-cols-3">
        {[
          { title: "Contacted", count: 4, items: ["Riverside Pizza", "Pine Dental"] },
          { title: "Underwriting", count: 3, items: ["Sierra Coffee", "Atlas Salon"], gold: true },
          { title: "Onboarding", count: 7, items: ["North Ridge Auto", "Jasmine's Tacos"] },
        ].map((column) => (
          <div key={column.title} className="md-kanban-col rounded-2xl border border-[#101318]/10 bg-[#f7f8f4] p-3" data-kanban-column={column.title}>
            <div className="mb-3 flex items-center justify-between text-sm font-black text-[#2f3e4d]">
              <span>{column.title}</span>
              <span className="rounded-full bg-white px-2 py-1">{column.count}</span>
            </div>
            <div className="grid gap-2" data-kanban-list>
              {column.items.map((item) => (
                <div
                  key={item}
                  className={column.gold ? "md-kanban-card cursor-grab rounded-xl bg-[#e9d7a1] p-3 text-sm font-black active:cursor-grabbing" : "md-kanban-card cursor-grab rounded-xl bg-white p-3 text-sm font-black active:cursor-grabbing"}
                  draggable
                  data-kanban-card={`${column.title}-${item}`}
                >
                  {item}
                  <span className="mt-1 block text-xs font-bold text-[#2f3e4d]/70">$14k vol</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const rows = {
    rules: ["Documents complete", "Volume under threshold", "Risk keyword review", "Decision logged"],
    timeline: ["Application received", "Signature packet sent", "Voided check uploaded", "Processor setup complete"],
    ledger: ["Residual imported", "Personal split calculated", "Team override capped", "Payroll export queued"],
    reports: ["Manager scope checked", "CSV built server-side", "Export audit logged", "CPA file ready"],
    teams: ["Recruit added", "Active status checked", "Manager view updated", "Override protected"],
  }[kind] ?? ["Workflow started", "Review complete", "Audit logged", "Ready"];

  return (
    <div className="rounded-[1.5rem] bg-[#101318] p-5 text-white shadow-[0_24px_60px_rgba(16,19,24,0.2)]">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <p className="font-black">Live desk preview</p>
        <span className="rounded-full bg-[#138a72] px-3 py-1 text-xs font-black uppercase tracking-[0.12em]">Synced</span>
      </div>
      <div className="mt-5 grid gap-3">
        {rows.map((row, index) => (
          <div key={row} className="flex items-center gap-3 rounded-2xl bg-white/[0.08] p-4">
            <span className={index === rows.length - 1 ? "flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9d7a1] text-[#101318]" : "flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#101318]"}>
              <Check className="h-4 w-4" />
            </span>
            <span className="font-bold text-white/86">{row}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="relative z-10 px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          kicker="Workflow"
          title={
            <>
              From real work in, to <em>activated merchant out.</em>
            </>
          }
          description="No stage clicking. No status fields nobody updates. MerchantDesk advances the deal from the work that actually happened."
        />

        <div className="grid gap-5 lg:grid-cols-4">
          {workflowSteps.map((step) => (
            <article key={step.number} className="md-reveal rounded-[2rem] border border-[#101318]/10 bg-white/78 p-6 shadow-sm backdrop-blur">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101318] text-sm font-black text-[#e9d7a1]">{step.number}</div>
              <h3 className="text-xl font-black tracking-[-0.02em]">{step.title}</h3>
              <p className="mt-3 min-h-28 text-sm leading-6 text-[#2f3e4d]">{step.description}</p>
              <div className="mt-5 grid gap-2">
                {step.rows.map((row) => (
                  <div key={row} className="rounded-xl border border-[#101318]/10 bg-[#f7f8f4] px-3 py-2 text-sm font-bold text-[#2f3e4d]">
                    {row}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CopilotSection() {
  return (
    <section id="copilot" className="relative z-10 border-y border-[#101318]/10 bg-white px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-2">
        <div className="md-reveal">
          <p className="md-kicker text-[#d4be7f]">Agent Copilot</p>
          <h2 className="text-4xl font-black leading-none tracking-[-0.04em] sm:text-5xl">
            AI that knows your <span className="font-serif italic font-normal text-[#2f3e4d]">book,</span> not just your data.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#2f3e4d]">
            Copilot reads your merchant timeline, residual history, and open tasks, then drafts follow-ups, summarizes activity, and proposes write actions you confirm.
          </p>
          <ul className="mt-7 grid gap-4">
            {[
              "Confirmation-first writes. Every Copilot action is reviewable before it touches your CRM.",
              "Daily reminders. Auto-generated follow-ups with optional email and SMS delivery.",
              "Weekly summaries. A practical briefing of every agent's week.",
              "Memory export. Copilot intelligence persists across sessions and can be reviewed for compliance.",
            ].map((item) => (
              <CheckItem key={item}>{item}</CheckItem>
            ))}
          </ul>
        </div>

        <div className="md-reveal overflow-hidden rounded-[2rem] border border-[#101318]/10 bg-white shadow-[0_40px_100px_rgba(16,19,24,0.16)]">
          <div className="flex items-center gap-3 border-b border-[#101318]/10 bg-[#f7f8f4] p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#101318] text-[#e9d7a1]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-black">Copilot</p>
              <p className="text-sm font-bold text-[#138a72]">online</p>
            </div>
          </div>
          <div className="grid min-h-80 gap-4 bg-gradient-to-b from-[#f7f8f4] to-white p-5">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#101318] px-4 py-3 text-sm font-semibold text-white">
              What is outstanding on Sierra Coffee?
            </div>
            <div
              className="md-typewriter min-h-28 max-w-[90%] rounded-2xl rounded-bl-md border border-[#101318]/10 bg-[#f7f8f4] px-4 py-3 text-sm leading-6 text-[#101318]"
              data-type="Sierra Coffee is in underwriting. Missing one voided check - last requested 4 days ago. Want me to draft the follow-up and create a task for tomorrow?"
            >
              Sierra Coffee is in underwriting. Missing one voided check - last requested 4 days ago. Want me to draft the follow-up and create a task for tomorrow?
            </div>
            <div className="max-w-[92%] rounded-2xl border border-dashed border-[#101318]/20 bg-[#e9d7a1]/20 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5a6b7d]">Suggested actions - tap to confirm</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Draft email - Voided check request", "Create task - Follow up tomorrow 9 AM", "Add timeline note"].map((action) => (
                  <button key={action} type="button" className="inline-flex items-center gap-2 rounded-full border border-[#101318]/10 bg-white px-3 py-2 text-xs font-black">
                    <Check className="h-3.5 w-3.5 text-[#138a72]" />
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 border-t border-[#101318]/10 p-4">
            <input className="h-11 flex-1 rounded-full border border-[#101318]/10 px-4 text-sm outline-none focus:border-[#0e5ec9]" placeholder="Ask Copilot anything..." aria-label="Chat with Copilot" />
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#101318] text-white" aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompensationSection() {
  return (
    <section id="compensation" className="relative z-10 px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          kicker="Compensation rules"
          title={
            <>
              A comp plan you can <em>actually explain.</em>
            </>
          }
          description="No mysterious split tables. MerchantDesk ships with the same rules your team needs to recruit on."
        />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {compCards.map((card) => (
            <article key={card.title} className="md-reveal rounded-[2rem] border border-[#101318]/10 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <p className="text-5xl font-black leading-none tracking-[-0.06em]">
                {card.value}
              </p>
              <h3 className="mt-5 text-xl font-black tracking-[-0.02em]">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#2f3e4d]">{card.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntegrationsSection() {
  return (
    <section className="relative z-10 border-y border-[#101318]/10 bg-white px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          kicker="Integrations"
          title={
            <>
              Connected where it <em>has to be.</em>
            </>
          }
          description="Encrypted credentials. OAuth where available. Adapter abstraction for everything else."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <article key={integration.name} className="md-reveal rounded-[1.75rem] border border-[#101318]/10 bg-[#f7f8f4] p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5a6b7d]">{integration.category}</p>
              <h3 className="mt-4 text-xl font-black tracking-[-0.02em]">{integration.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[#2f3e4d]">{integration.detail}</p>
              <span className={integration.status === "Live" ? "mt-5 inline-flex rounded-full bg-[#138a72]/15 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#138a72]" : "mt-5 inline-flex rounded-full bg-[#e9d7a1]/50 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#846429]"}>
                {integration.status}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="relative z-10 px-5 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-[1240px] gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <article key={stat.label} className="md-reveal rounded-[2rem] border border-[#101318]/10 bg-white p-7 shadow-sm">
            <p className="text-5xl font-black tracking-[-0.05em]">
              <CounterValue count={stat.count} decimals={stat.decimals} prefix={stat.prefix} suffix={stat.suffix} />
            </p>
            <p className="mt-3 text-sm leading-6 text-[#2f3e4d]">{stat.label}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="relative z-10 border-y border-[#101318]/10 bg-white px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          kicker="From the desk"
          title={
            <>
              Teams that switched <em>are not going back.</em>
            </>
          }
        />
        <div className="grid gap-5 lg:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.name} className="md-reveal rounded-[2rem] border border-[#101318]/10 bg-[#f7f8f4] p-7 shadow-sm">
              <p className="text-base leading-7 text-[#101318]">{item.quote}</p>
              <div className="mt-7 flex items-center gap-3 border-t border-[#101318]/10 pt-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#101318] text-sm font-black text-[#e9d7a1]">
                  {item.initials}
                </span>
                <div>
                  <p className="font-black">{item.name}</p>
                  <p className="text-sm font-semibold text-[#5a6b7d]">{item.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="relative z-10 px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          kicker="Pricing"
          title={
            <>
              Built for one agent. Scales to <em>every team.</em>
            </>
          }
          description="Invite-only access while we scale. Reach out and we will match you to the right plan."
        />
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {pricing.map((plan) => (
            <article
              key={plan.name}
              className={[
                "md-reveal relative flex rounded-[2rem] border p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl",
                plan.featured ? "border-[#101318] bg-[#101318] text-white shadow-[0_32px_80px_rgba(16,19,24,0.25)]" : "border-[#101318]/10 bg-white",
              ].join(" ")}
            >
              {plan.featured ? (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e9d7a1] px-4 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#101318]">
                  Most popular
                </div>
              ) : null}
              <div className="flex w-full flex-col">
                <header className={plan.featured ? "border-b border-white/15 pb-5" : "border-b border-[#101318]/10 pb-5"}>
                  <h3 className="text-2xl font-black tracking-[-0.03em]">{plan.name}</h3>
                  <p className="mt-3 text-5xl font-black tracking-[-0.05em]">
                    {plan.price}
                    {plan.suffix ? <span className={plan.featured ? "text-base tracking-normal text-white/60" : "text-base tracking-normal text-[#5a6b7d]"}>{plan.suffix}</span> : null}
                  </p>
                  <p className={plan.featured ? "mt-3 text-sm leading-6 text-white/68" : "mt-3 text-sm leading-6 text-[#2f3e4d]"}>{plan.description}</p>
                </header>
                <ul className="my-6 grid gap-3">
                  {plan.features.map((feature) => (
                    <CheckItem key={feature} dark={plan.featured}>
                      {feature}
                    </CheckItem>
                  ))}
                </ul>
                <a href="#demo" className={plan.featured ? "md-btn mt-auto w-full bg-[#e9d7a1] text-[#101318] hover:bg-[#d4be7f]" : "md-btn md-btn-ghost mt-auto w-full"}>
                  Request access
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="relative z-10 border-y border-[#101318]/10 bg-white px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="md-reveal">
          <p className="md-kicker">Common questions</p>
          <h2 className="text-4xl font-black leading-none tracking-[-0.04em] sm:text-5xl">
            Answers, before you <span className="font-serif italic font-normal text-[#2f3e4d]">ask.</span>
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#2f3e4d]">
            Need more detail? <a href="#demo" className="font-black text-[#0e5ec9] underline underline-offset-4">Talk to the team</a>.
          </p>
        </div>
        <div className="grid gap-3">
          {faqs.map((faq, index) => (
            <details key={faq.question} className="md-reveal group rounded-2xl border border-[#101318]/10 bg-[#f7f8f4] p-0 shadow-sm open:border-[#101318] open:bg-white" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-lg font-black tracking-[-0.02em] marker:hidden">
                {faq.question}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#2f3e4d] group-open:bg-[#101318] group-open:text-[#e9d7a1]">+</span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-7 text-[#2f3e4d]">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({
  result,
  isPending,
  onSubmit,
}: {
  result: RequestAccessResult | null;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section id="demo" className="relative z-10 px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <div className="md-reveal relative overflow-hidden rounded-[2.5rem] bg-[#101318] px-6 py-16 text-center text-white shadow-[0_40px_100px_rgba(16,19,24,0.3)] sm:px-12 lg:px-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(233,215,161,0.34),transparent_36%),radial-gradient(circle_at_10%_100%,rgba(14,94,201,0.32),transparent_35%)]" />
          <div className="relative z-10">
            <p className="md-kicker text-[#e9d7a1]">Ready when you are</p>
            <h2 className="mx-auto max-w-3xl text-4xl font-black leading-none tracking-[-0.04em] sm:text-5xl">
              See your book in {brand.productName} <span className="font-serif italic font-normal text-[#e9d7a1]">this week.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/76">
              Private demo, no sales pitch. We will walk through your real workflow, the Opportunity desk, Copilot, and residual reconciliation.
            </p>
            <form className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
              <label className="sr-only" htmlFor="request-access-email">
                Work email
              </label>
              <input
                id="request-access-email"
                name="email"
                type="email"
                required
                placeholder="you@yourdomain.com"
                className="h-13 flex-1 rounded-full border border-white/20 bg-white/10 px-5 text-white outline-none placeholder:text-white/45 focus:border-[#e9d7a1]"
              />
              <button type="submit" className="md-btn md-btn-lg bg-[#e9d7a1] text-[#101318] hover:bg-[#d4be7f] disabled:cursor-not-allowed disabled:opacity-70" disabled={isPending}>
                {isPending ? "Sending..." : result?.ok ? "Request sent" : "Request access"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <p className={result?.ok ? "mt-5 text-sm font-semibold text-[#e9d7a1]" : result?.error ? "mt-5 text-sm font-semibold text-red-200" : "mt-5 text-sm text-white/50"} aria-live="polite">
              {result?.ok ? "Request sent. We will reply within one business day." : result?.error ?? "We will reply within one business day. No spam, no drip funnel."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 bg-[#101318] px-5 py-16 text-white/70 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-[1240px] gap-10 border-b border-white/10 pb-12 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3 font-black text-white">
            <MerchantMark />
            <span className="text-lg">{brand.productName}</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/50">The merchant services command center.</p>
        </div>
        <FooterColumn title="Product" items={navItems.slice(0, 5)} />
        <FooterColumn
          title="Company"
          items={[
            { label: "Request access", href: "#demo" },
            { label: "GitHub", href: "https://github.com/jsayles08/Merchant-Processing-CRM" },
            { label: "FAQ", href: "#faq" },
            { label: "Contact", href: `mailto:${brand.supportEmail}` },
          ]}
        />
        <FooterColumn
          title="Legal"
          items={[
            { label: "Terms", href: "#faq" },
            { label: "Privacy", href: "#faq" },
            { label: "Security", href: "#faq" },
            { label: "DPA", href: "#faq" },
          ]}
        />
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 pt-7 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
        <p>Copyright 2026 {brand.productName}. All rights reserved.</p>
        <p>Built for merchant services, with care.</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#e9d7a1]">{title}</h3>
      <div className="grid gap-2">
        {items.map((item) => (
          <a key={`${title}-${item.label}`} href={item.href} className="text-sm transition hover:text-white">
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <div className="md-reveal mx-auto mb-14 max-w-3xl text-center">
      <p className="md-kicker">{kicker}</p>
      <h2 className="text-4xl font-black leading-none tracking-[-0.04em] sm:text-5xl">{title}</h2>
      {description ? <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#2f3e4d]">{description}</p> : null}
    </div>
  );
}

function CounterValue({
  count,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  count: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const value = count.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className="md-count" data-count={count} data-decimals={decimals} data-prefix={prefix} data-suffix={suffix}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

function CheckItem({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <li className={dark ? "flex items-start gap-3 text-sm font-semibold leading-6 text-white/88" : "flex items-start gap-3 text-sm font-semibold leading-6 text-[#2f3e4d]"}>
      <span className={dark ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e9d7a1] text-[#101318]" : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#138a72] text-white"}>
        <Check className="h-3.5 w-3.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

function MerchantMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] bg-[#101318] text-[#e9d7a1] shadow-sm" aria-hidden="true">
      <LineChart className="h-5 w-5" />
    </span>
  );
}
