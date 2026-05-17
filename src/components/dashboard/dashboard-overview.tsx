"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Edit3,
  ExternalLink,
  FileCheck2,
  Mail,
  Maximize2,
  MoreHorizontal,
  Phone,
  Plus,
  ReceiptText,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  UserCog,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { pipelineStages } from "@/lib/demo-data";
import type { CrmData, Deal, Merchant, Task } from "@/lib/types";
import { currency, daysBetween, titleCase } from "@/lib/utils";

type InteractionCard = {
  deal: Deal | null;
  merchant: Merchant;
  value: number;
};

type MenuItem = {
  label: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
};

type PortfolioAlert = {
  title: string;
  helper: string;
  href: string;
  merchantId?: string;
  tone: "blue" | "amber" | "rose" | "slate";
};

const dealPalettes = [
  {
    card: "bg-[#0E5EC9] text-white shadow-[0_20px_42px_rgba(14,94,201,0.24)]",
    muted: "text-blue-100",
    chip: "bg-white/12 text-white",
  },
  {
    card: "bg-[#25425E] text-white shadow-[0_20px_42px_rgba(37,66,94,0.22)]",
    muted: "text-slate-200",
    chip: "bg-white/15 text-white",
  },
  {
    card: "bg-black text-white shadow-[0_22px_48px_rgba(0,0,0,0.20)]",
    muted: "text-slate-300",
    chip: "bg-white/12 text-white",
  },
  {
    card: "bg-[#E9D7A1] text-[#0B0F15] shadow-[0_20px_42px_rgba(213,125,37,0.16)]",
    muted: "text-[#25425E]",
    chip: "bg-black/8 text-slate-950",
  },
  {
    card: "bg-white/55 text-slate-950 shadow-[0_16px_35px_rgba(15,23,42,0.08)]",
    muted: "text-slate-500",
    chip: "bg-white/55 text-slate-700",
  },
  {
    card: "bg-white/45 text-slate-950 shadow-[0_16px_35px_rgba(15,23,42,0.08)]",
    muted: "text-slate-500",
    chip: "bg-white/55 text-slate-700",
  },
];

export function DashboardOverview({ data }: { data: CrmData }) {
  const allCards = useMemo<InteractionCard[]>(() => {
    const source = data.deals
      .flatMap((deal) => {
        const merchant = data.merchants.find((item) => item.id === deal.merchant_id);
        return merchant
          ? [
              {
                deal,
                merchant,
                value: deal.estimated_residual || deal.estimated_monthly_volume,
              },
            ]
          : [];
      })
      .sort((a, b) => b.value - a.value);

    if (source.length) return source;

    return data.merchants.map((merchant) => ({
      deal: null,
      merchant,
      value: merchant.monthly_volume_estimate,
    }));
  }, [data.deals, data.merchants]);

  const [selectedMerchantId, setSelectedMerchantId] = useState(allCards[0]?.merchant.id ?? data.merchants[0]?.id ?? "");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(new Date().getDate());
  const [funnelMode, setFunnelMode] = useState<"weighted" | "total">("weighted");
  const [actionMessage, setActionMessage] = useState("");

  const cards = showAllHistory ? allCards.slice(0, 12) : allCards.slice(0, 6);
  const selectedMerchant = data.merchants.find((merchant) => merchant.id === selectedMerchantId) ?? cards[0]?.merchant ?? data.merchants[0];
  const selectedDeal = selectedMerchant ? data.deals.find((deal) => deal.merchant_id === selectedMerchant.id) ?? null : null;
  const selectedAgent = selectedMerchant
    ? data.agents.find((agent) => agent.id === selectedMerchant.assigned_agent_id)
    : null;
  const selectedProfile = selectedAgent
    ? data.profiles.find((profile) => profile.id === selectedAgent.profile_id)
    : null;

  const processingVolume = data.residuals.reduce((sum, residual) => sum + residual.processing_volume, 0);
  const pipelineValue = data.deals.reduce((sum, deal) => sum + deal.estimated_monthly_volume, 0);
  const weightedPipelineValue = data.deals.reduce(
    (sum, deal) => sum + deal.estimated_monthly_volume * (deal.close_probability / 100),
    0,
  );
  const activeTasks = data.tasks.filter((task) => task.status !== "completed").length;
  const recentMerchants = data.merchants.filter((merchant) => daysBetween(merchant.created_at) <= 7).length;
  const totalWonResidual = data.residuals.reduce((sum, residual) => sum + residual.net_residual, 0);
  const pendingApprovals = data.deals.filter((deal) => deal.approval_status === "pending").length;
  const underwritingCount = data.merchants.filter((merchant) => merchant.status === "underwriting").length;
  const processorImportIssues = data.residualImportBatches.reduce((sum, batch) => sum + batch.error_count, 0);
  const portfolioAlerts = useMemo(() => buildPortfolioAlerts(data), [data]);

  const stageRows = pipelineStages
    .map((stage) => {
      const stageDeals = data.deals.filter((deal) => deal.stage === stage.id);
      const total = stageDeals.reduce((sum, deal) => sum + deal.estimated_monthly_volume, 0);
      const weighted = stageDeals.reduce((sum, deal) => sum + deal.estimated_monthly_volume * (deal.close_probability / 100), 0);
      return { ...stage, total, weighted, deals: stageDeals, count: stageDeals.length };
    })
    .filter((stage) => stage.total > 0 || stage.count > 0);
  const largestStage = Math.max(...stageRows.map((stage) => (funnelMode === "weighted" ? stage.weighted : stage.total)), 1);

  const scheduleDate = new Date();
  scheduleDate.setDate(1);
  scheduleDate.setMonth(scheduleDate.getMonth() + calendarOffset);
  const scheduleYear = scheduleDate.getFullYear();
  const scheduleMonthIndex = scheduleDate.getMonth();
  const scheduleMonth = scheduleDate.toLocaleDateString("en-US", { month: "long" });
  const daysInScheduleMonth = new Date(scheduleYear, scheduleMonthIndex + 1, 0).getDate();
  const scheduleDays = scheduleExpanded ? daysInScheduleMonth : Math.min(daysInScheduleMonth, 21);
  const selectedScheduleDate = formatLocalDate(scheduleYear, scheduleMonthIndex, Math.min(selectedScheduleDay, daysInScheduleMonth));
  const selectedScheduleTasks = useMemo(
    () => tasksForDay(data.tasks, scheduleYear, scheduleMonthIndex, Math.min(selectedScheduleDay, daysInScheduleMonth)),
    [data.tasks, daysInScheduleMonth, scheduleMonthIndex, scheduleYear, selectedScheduleDay],
  );

  function selectMerchant(merchantId: string, message?: string) {
    setSelectedMerchantId(merchantId);
    if (message) setActionMessage(message);
  }

  function selectNextMerchant() {
    if (!data.merchants.length || !selectedMerchant) return;
    const index = data.merchants.findIndex((merchant) => merchant.id === selectedMerchant.id);
    const nextMerchant = data.merchants[(index + 1) % data.merchants.length];
    selectMerchant(nextMerchant.id, `Showing actions for ${nextMerchant.business_name}.`);
  }

  async function shareContact() {
    if (!selectedMerchant) return;
    const contactUrl = `${window.location.origin}/merchants/${selectedMerchant.id}`;
    const text = `${selectedMerchant.contact_name || selectedMerchant.business_name} | ${selectedMerchant.business_name} | ${
      selectedMerchant.contact_email || "No email"
    } | ${
      selectedMerchant.contact_phone || "No phone"
    } | ${contactUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedMerchant.business_name,
          text,
          url: contactUrl,
        });
        setActionMessage("Contact shared.");
        return;
      }
    } catch {
      // Native share can be cancelled or unavailable in preview browsers; clipboard is the fallback.
    }

    await copyText(text, "Contact copied with MerchantDesk profile link.");
  }

  async function copyText(text: string, successMessage: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setActionMessage(successMessage);
        return;
      }
    } catch {
      // Clipboard access can be blocked in previews; show the exact content so it is still usable.
    }

    setActionMessage(text);
  }

  function copyMerchantSummary(merchant: Merchant, deal: Deal | null) {
    void copyText(
      `${merchant.business_name} | ${merchant.contact_name || "No contact"} | ${merchant.contact_email || "No email"} | ${
        merchant.contact_phone || "No phone"
      } | ${titleCase(deal?.stage ?? merchant.status)} | ${currency(deal?.estimated_monthly_volume ?? merchant.monthly_volume_estimate)}`,
      `${merchant.business_name} summary copied.`,
    );
  }

  function copyPipelineSummary() {
    void copyText(
      stageRows
        .map((stage) => `${stage.label}: ${stage.count} deals / ${currency(funnelMode === "weighted" ? stage.weighted : stage.total)}`)
        .join("\n"),
      "Pipeline summary copied.",
    );
  }

  function selectScheduleDay(day: number, dayTasks: Task[]) {
    setSelectedScheduleDay(day);
    const firstMerchant = dayTasks[0]?.merchant_id
      ? data.merchants.find((merchant) => merchant.id === dayTasks[0].merchant_id)
      : null;
    if (firstMerchant) {
      setSelectedMerchantId(firstMerchant.id);
    }
    setActionMessage(
      dayTasks.length
        ? `${dayTasks.length} task${dayTasks.length === 1 ? "" : "s"} due on ${scheduleMonth} ${day}.`
        : `No tasks due on ${scheduleMonth} ${day}. Use Add Task to schedule follow-up work.`,
    );
  }

  return (
    <section id="dashboard" className="crm-dashboard-motion grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <div className="crm-dashboard-kpis grid gap-4 md:grid-cols-3">
          <StatPill
            icon={<Share2 className="h-5 w-5" />}
            value={currency(totalWonResidual || processingVolume)}
            label="Won from live deals"
            accent="+11% week"
            accentClassName="bg-[#E9D7A1] text-[#0B0F15]"
          />
          <StatPill
            icon={<UserRound className="h-5 w-5" />}
            value={`+${recentMerchants || data.merchants.length}`}
            label="New customers"
            accent="+12 today"
            accentClassName="bg-[#0E5EC9] text-white"
          />
          <StatPill
            icon={<ClipboardList className="h-5 w-5" />}
            value={`+${activeTasks}`}
            label="New tasks"
            accent="+6 today"
            accentClassName="bg-white/75 text-[#25425E]"
          />
        </div>

        {actionMessage ? (
          <div className="crm-dashboard-flash rounded-[22px] border border-black/10 bg-white/45 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] backdrop-blur">
            {actionMessage}
          </div>
        ) : null}

        <ProcessingWorkbench
          pendingApprovals={pendingApprovals}
          underwritingCount={underwritingCount}
          documentCount={data.documents.length}
          processorImportIssues={processorImportIssues}
        />

        <RiskAlertStrip
          alerts={portfolioAlerts}
          onSelectMerchant={(merchantId, message) => selectMerchant(merchantId, message)}
        />

        <Panel
          title="Interaction History"
          actions={
            <>
              <MenuButton
                label="Interaction history menu"
                items={[
                  {
                    label: showAllHistory ? "Show top six" : "Show all history",
                    onSelect: () => {
                      setShowAllHistory((current) => !current);
                      setActionMessage(showAllHistory ? "Showing the top six opportunities." : "Showing more opportunity history.");
                    },
                  },
                  { label: "Open opportunities", href: "/opportunities" },
                  ...(selectedMerchant
                    ? [{ label: "Open selected merchant", href: `/merchants/${selectedMerchant.id}` }]
                    : []),
                  { label: "Copy pipeline summary", onSelect: copyPipelineSummary },
                ]}
              />
              <IconLink label="Open opportunities" href="/opportunities">
                <ArrowUpRight className="h-4 w-4" />
              </IconLink>
            </>
          }
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {cards.map((card, index) => (
              <OpportunityTile
                key={card.deal?.id ?? card.merchant.id}
                card={card}
                palette={dealPalettes[index % dealPalettes.length]}
                selected={selectedMerchant?.id === card.merchant.id}
                onSelect={() => selectMerchant(card.merchant.id, `${card.merchant.business_name} selected.`)}
                menuItems={[
                  { label: "Open profile", href: `/merchants/${card.merchant.id}` },
                  { label: "Add follow-up task", href: `/tasks?merchant=${card.merchant.id}` },
                  { label: "Message Copilot about this merchant", href: `/copilot?merchant=${card.merchant.id}` },
                  { label: "Copy contact summary", onSelect: () => copyMerchantSummary(card.merchant, card.deal) },
                ]}
              />
            ))}
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel
            title="Tasks Schedule"
            actions={
              <>
                <IconButton
                  label="Previous month"
                  onClick={() => {
                    setCalendarOffset((current) => current - 1);
                    setActionMessage("Schedule moved to the previous month.");
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Next month"
                  onClick={() => {
                    setCalendarOffset((current) => current + 1);
                    setActionMessage("Schedule moved to the next month.");
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                </IconButton>
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-2xl font-semibold">{scheduleMonth}</p>
              <IconButton
                label={scheduleExpanded ? "Collapse schedule" : "Expand schedule"}
                onClick={() => {
                  setScheduleExpanded((current) => !current);
                  setActionMessage(scheduleExpanded ? "Schedule collapsed." : "Schedule expanded to a five-week view.");
                }}
              >
                <Maximize2 className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: scheduleDays }, (_, item) => item + 1).map((day) => {
                const dayTasks = tasksForDay(data.tasks, scheduleYear, scheduleMonthIndex, day);
                const primaryTask = dayTasks[0];
                const active = dayTasks.length > 0;
                const selected = day === Math.min(selectedScheduleDay, daysInScheduleMonth);
                const hasHighPriority = dayTasks.some((task) => task.priority === "high");
                const hasMediumPriority = dayTasks.some((task) => task.priority === "medium");
                const color =
                  selected
                    ? "bg-black text-white"
                    : hasHighPriority
                      ? "bg-[#D57D25] text-white"
                      : hasMediumPriority
                        ? "bg-[#E9D7A1] text-[#0B0F15]"
                        : active
                    ? "bg-[#0E5EC9] text-white"
                    : "bg-white/32 text-slate-500";

                return (
                  <button
                    key={`${scheduleMonth}-${day}`}
                    type="button"
                    aria-label={`${scheduleMonth} ${day}: ${dayTasks.length} task${dayTasks.length === 1 ? "" : "s"}`}
                    onClick={() => selectScheduleDay(day, dayTasks)}
                    className={`crm-dashboard-calendar-day min-h-20 rounded-2xl p-2 text-left text-xs transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-black/20 ${color}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{day}</span>
                      {active ? <AvatarStack names={[primaryTask?.title ?? "Task", selectedMerchant?.contact_name ?? "Merchant"]} /> : null}
                    </div>
                    {active ? <span className="mt-5 block text-[11px] font-bold">{dayTasks.length} due</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-[24px] border border-[#ABB7C0]/25 bg-white/45 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-[#25425E]/65">
                    {new Date(`${selectedScheduleDate}T09:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <h3 className="text-lg font-black text-[#0B0F15]">
                    {selectedScheduleTasks.length
                      ? `${selectedScheduleTasks.length} scheduled task${selectedScheduleTasks.length === 1 ? "" : "s"}`
                      : "No work scheduled"}
                  </h3>
                </div>
                <Link
                  href={`/tasks?${new URLSearchParams({
                    ...(selectedMerchant ? { merchant: selectedMerchant.id } : {}),
                    due: `${selectedScheduleDate}T09:00`,
                  }).toString()}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#0B0F15] px-4 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {selectedScheduleTasks.map((task) => {
                  const merchant = task.merchant_id ? data.merchants.find((item) => item.id === task.merchant_id) : null;
                  return (
                    <Link
                      key={task.id}
                      href={task.merchant_id ? `/tasks?merchant=${task.merchant_id}` : "/tasks"}
                      className="crm-dashboard-task-row block rounded-2xl border border-[#ABB7C0]/20 bg-white/55 p-3 text-sm transition hover:bg-white"
                      onClick={() => {
                        if (merchant) setSelectedMerchantId(merchant.id);
                      }}
                    >
                      <span className="font-bold text-[#0B0F15]">{task.title}</span>
                      <span className="mt-1 block text-[#25425E]/70">
                        {merchant?.business_name ?? "No merchant"} · {new Date(task.due_date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </Link>
                  );
                })}
                {!selectedScheduleTasks.length ? (
                  <p className="text-sm leading-6 text-[#25425E]/70">
                    Click Add Task to create a follow-up on this date. The task will be stored in Supabase and appear here when the dashboard reloads.
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel
            title="Stage Funnel"
            actions={
              <>
                <MenuButton
                  label="Funnel menu"
                  items={[
                    {
                      label: "Show weighted pipeline",
                      onSelect: () => {
                        setFunnelMode("weighted");
                        setActionMessage("Showing weighted pipeline.");
                      },
                    },
                    {
                      label: "Show total pipeline",
                      onSelect: () => {
                        setFunnelMode("total");
                        setActionMessage("Showing total pipeline.");
                      },
                    },
                    { label: "Open opportunities", href: "/opportunities" },
                    { label: "Copy funnel summary", onSelect: copyPipelineSummary },
                  ]}
                />
                <IconLink label="Expand funnel" href="/opportunities">
                  <ArrowUpRight className="h-4 w-4" />
                </IconLink>
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold">{currency(funnelMode === "weighted" ? weightedPipelineValue : pipelineValue)}</p>
                <p className="text-sm text-slate-500">{funnelMode === "weighted" ? "Weighted pipeline" : "Total in pipeline"}</p>
              </div>
              <div className="rounded-full bg-white/45 p-1 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setFunnelMode("weighted")}
                  className={`inline-flex rounded-full px-4 py-2 transition ${
                    funnelMode === "weighted" ? "bg-black text-white" : "text-slate-500 hover:text-slate-950"
                  }`}
                >
                  Weighted
                </button>
                <button
                  type="button"
                  onClick={() => setFunnelMode("total")}
                  className={`inline-flex rounded-full px-4 py-2 transition ${
                    funnelMode === "total" ? "bg-black text-white" : "text-slate-500 hover:text-slate-950"
                  }`}
                >
                  Total
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {stageRows.slice(0, 5).map((stage) => {
                const value = funnelMode === "weighted" ? stage.weighted : stage.total;
                const firstMerchant = data.merchants.find((merchant) => merchant.id === stage.deals[0]?.merchant_id);

                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => {
                      if (firstMerchant) {
                        selectMerchant(firstMerchant.id, `${stage.label} opened with ${firstMerchant.business_name}.`);
                      } else {
                        setActionMessage(`${stage.label} has no assigned merchant yet.`);
                      }
                    }}
                    className="crm-dashboard-funnel-row w-full rounded-3xl bg-white/35 p-4 text-left transition hover:bg-white/55 focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-slate-600">{stage.label}</span>
                      <span className="font-semibold">{currency(value)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/55">
                      <div
                        className="h-3 rounded-full bg-black"
                        style={{ width: `${Math.max(10, Math.round((value / largestStage) * 100))}%` }}
                      />
                    </div>
                  </button>
                );
              })}
              {!stageRows.length ? <p className="text-sm text-slate-500">No active pipeline stages yet.</p> : null}
            </div>
          </Panel>
        </div>
      </div>

      <aside className="crm-dashboard-aside space-y-6 xl:sticky xl:top-28 xl:self-start">
        <CustomerCard
          merchant={selectedMerchant}
          deal={selectedDeal}
          onShare={() => {
            void shareContact();
          }}
          onSelectNext={selectNextMerchant}
        />
        <DetailCard merchant={selectedMerchant} agentName={selectedProfile?.full_name ?? "Unassigned"} />
      </aside>
    </section>
  );
}

function RiskAlertStrip({
  alerts,
  onSelectMerchant,
}: {
  alerts: PortfolioAlert[];
  onSelectMerchant: (merchantId: string, message: string) => void;
}) {
  if (!alerts.length) {
    return (
      <div className="crm-dashboard-panel crm-panel rounded-[28px] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0E5EC9]/10 text-[#0E5EC9]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black text-[#0B0F15]">Portfolio monitoring clear</p>
            <p className="text-sm text-[#25425E]/70">No pricing, underwriting, signature, residual import, or overdue-task alerts are currently visible.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-dashboard-alerts grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {alerts.map((alert) => {
        const content = (
          <>
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full ${alertToneClass(alert.tone)}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <p className="text-sm font-black text-[#0B0F15]">{alert.title}</p>
            <p className="mt-1 text-sm leading-5 text-[#25425E]/70">{alert.helper}</p>
          </>
        );

        if (alert.merchantId) {
          return (
            <Link
              key={`${alert.title}-${alert.merchantId}`}
              href={alert.href}
              className="crm-dashboard-alert crm-card rounded-[26px] p-4 transition hover:-translate-y-0.5"
              onClick={() => onSelectMerchant(alert.merchantId!, alert.title)}
            >
              {content}
            </Link>
          );
        }

        return (
          <Link key={alert.title} href={alert.href} className="crm-dashboard-alert crm-card rounded-[26px] p-4 transition hover:-translate-y-0.5">
            {content}
          </Link>
        );
      })}
    </div>
  );
}

function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="crm-dashboard-panel crm-card rounded-[34px] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-[#0B0F15]">{title}</h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function ProcessingWorkbench({
  pendingApprovals,
  underwritingCount,
  documentCount,
  processorImportIssues,
}: {
  pendingApprovals: number;
  underwritingCount: number;
  documentCount: number;
  processorImportIssues: number;
}) {
  const actions = [
    {
      label: "Pricing approvals",
      value: pendingApprovals.toString(),
      helper: "Manager queue",
      href: "/opportunities#approval-requests",
      icon: <ShieldCheck className="h-4 w-4" />,
      tone: "bg-[#0E5EC9] text-white",
    },
    {
      label: "Underwriting desk",
      value: underwritingCount.toString(),
      helper: "Apps in review",
      href: "/opportunities",
      icon: <FileCheck2 className="h-4 w-4" />,
      tone: "bg-[#25425E] text-white",
    },
    {
      label: "Document vault",
      value: documentCount.toString(),
      helper: "Private files",
      href: "/documents",
      icon: <UploadCloud className="h-4 w-4" />,
      tone: "bg-[#D57D25] text-white",
    },
    {
      label: "Residual import",
      value: processorImportIssues.toString(),
      helper: "Exceptions",
      href: "/reports",
      icon: <ReceiptText className="h-4 w-4" />,
      tone: "bg-[#E9D7A1] text-[#0B0F15]",
    },
    {
      label: "Agent access",
      value: "Admin",
      helper: "Teams and roles",
      href: "/settings",
      icon: <UserCog className="h-4 w-4" />,
      tone: "bg-black text-white",
    },
  ];

  return (
    <div className="crm-dashboard-workbench grid gap-3 md:grid-cols-5">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="crm-dashboard-workbench-card crm-card group rounded-[28px] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_24px_58px_rgba(11,15,21,0.12)] focus:outline-none focus:ring-2 focus:ring-[#0E5EC9]/25"
        >
          <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-full ${action.tone}`}>{action.icon}</div>
          <p className="text-2xl font-black text-[#0B0F15]">{action.value}</p>
          <p className="mt-1 text-sm font-bold text-[#0B0F15]">{action.label}</p>
          <p className="text-xs font-medium text-[#25425E]/65">{action.helper}</p>
        </Link>
      ))}
    </div>
  );
}

function OpportunityTile({
  card,
  palette,
  selected,
  onSelect,
  menuItems,
}: {
  card: InteractionCard;
  palette: (typeof dealPalettes)[number];
  selected: boolean;
  onSelect: () => void;
  menuItems: MenuItem[];
}) {
  const date = card.deal?.expected_close_date
    ? new Date(card.deal.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : new Date(card.merchant.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div
      className={`crm-dashboard-opportunity min-h-44 rounded-[24px] p-5 text-left transition hover:-translate-y-1 hover:shadow-2xl ${palette.card} ${
        selected ? "ring-2 ring-black/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`Select ${card.merchant.business_name}`}
          onClick={onSelect}
          className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-black/30"
        >
          <p className={`text-sm font-medium ${palette.muted}`}>{date}</p>
          <h3 className="mt-3 max-w-[14rem] text-base font-semibold leading-5">{card.merchant.business_name}</h3>
          <p className={`mt-1 text-sm ${palette.muted}`}>{titleCase(card.deal?.stage ?? card.merchant.status)}</p>
        </button>
        <MenuButton label={`${card.merchant.business_name} actions`} items={menuItems} buttonClassName={palette.chip} />
      </div>
      <button
        type="button"
        aria-label={`Select ${card.merchant.business_name} value`}
        onClick={onSelect}
        className="mt-7 flex w-full items-end justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-black/30"
      >
        <p className="text-2xl font-bold">{currency(card.value)}</p>
        <AvatarStack names={[card.merchant.contact_name, card.merchant.business_name, card.merchant.industry]} />
      </button>
    </div>
  );
}

function CustomerCard({
  merchant,
  deal,
  onShare,
  onSelectNext,
}: {
  merchant?: Merchant;
  deal: Deal | null;
  onShare: () => void;
  onSelectNext: () => void;
}) {
  if (!merchant) {
    return (
      <Panel title="Customer">
        <p className="text-sm text-slate-500">Add a merchant to populate the customer workspace.</p>
      </Panel>
    );
  }

  const taskHref = `/tasks?merchant=${encodeURIComponent(merchant.id)}`;

  return (
    <div className="crm-dashboard-customer crm-card rounded-[34px] p-6 text-center">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-2">
          <IconButton label="Share contact" onClick={onShare}>
            <Share2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Next customer" onClick={onSelectNext}>
            <SlidersHorizontal className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex gap-2">
          <MenuButton
            label="More customer actions"
            items={[
              { label: "Open merchant profile", href: `/merchants/${merchant.id}` },
              { label: "Add follow-up task", href: taskHref },
              { label: "Open documents", href: "/documents" },
              { label: "Ask Copilot", href: `/copilot?merchant=${merchant.id}` },
              { label: "Copy share contact", onSelect: onShare },
            ]}
          />
          <IconLink label={`Open ${merchant.business_name}`} href={`/merchants/${merchant.id}`}>
            <ArrowUpRight className="h-4 w-4" />
          </IconLink>
        </div>
      </div>

      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#fff_0,#fff_24%,#E9D7A1_25%,#E9D7A1_52%,#D57D25_53%,#0E5EC9_100%)] text-3xl font-black text-white shadow-[0_18px_45px_rgba(14,94,201,0.18)]">
        {initials(merchant.contact_name || merchant.business_name)}
      </div>
      <h2 className="mt-6 text-2xl font-black text-slate-950">{merchant.contact_name || merchant.business_name}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-5 text-slate-500">
        {merchant.industry || "Merchant"} contact at {merchant.business_name}
      </p>
      <Badge className="mt-4 rounded-full border-black/10 bg-white/65 text-[#25425E]">
        {titleCase(deal?.stage ?? merchant.status)}
      </Badge>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <IconLink label="Edit merchant" href={`/merchants/${merchant.id}`}>
          <Edit3 className="h-4 w-4" />
        </IconLink>
        <IconAnchor label="Email merchant" href={merchant.contact_email ? `mailto:${merchant.contact_email}` : `/merchants/${merchant.id}`}>
          <Mail className="h-4 w-4" />
        </IconAnchor>
        <IconAnchor label="Call merchant" href={merchant.contact_phone ? `tel:${merchant.contact_phone}` : `/merchants/${merchant.id}`}>
          <Phone className="h-4 w-4" />
        </IconAnchor>
        <IconLink label="Add task" href={taskHref}>
          <Plus className="h-4 w-4" />
        </IconLink>
        <IconLink label="Schedule follow up" href={taskHref}>
          <CalendarDays className="h-4 w-4" />
        </IconLink>
      </div>
    </div>
  );
}

function DetailCard({ merchant, agentName }: { merchant?: Merchant; agentName: string }) {
  if (!merchant) return null;

  const details = [
    { icon: <UserRound className="h-4 w-4" />, label: "Business", value: merchant.business_name, href: `/merchants/${merchant.id}` },
    { icon: <Mail className="h-4 w-4" />, label: "Email", value: merchant.contact_email || "Missing", href: `/merchants/${merchant.id}` },
    { icon: <Phone className="h-4 w-4" />, label: "Phone", value: merchant.contact_phone || "Missing", href: `/merchants/${merchant.id}` },
    { icon: <UsersRound className="h-4 w-4" />, label: "Assigned agent", value: agentName, href: `/merchants/${merchant.id}` },
    { icon: <CalendarDays className="h-4 w-4" />, label: "Last contacted", value: new Date(merchant.updated_at).toLocaleString(), href: `/tasks?merchant=${merchant.id}` },
  ];

  return (
    <Panel
      title="Detailed Information"
      actions={
        <>
          <IconLink label="Edit details" href={`/merchants/${merchant.id}`}>
            <Edit3 className="h-4 w-4" />
          </IconLink>
          <IconLink label={`Open ${merchant.business_name} details`} href={`/merchants/${merchant.id}`}>
            <ExternalLink className="h-4 w-4" />
          </IconLink>
        </>
      }
    >
      <div className="space-y-4">
        {details.map((item) => (
          <div key={item.label} className="crm-dashboard-detail-row grid grid-cols-[1.5rem_1fr_auto] items-center gap-3">
            <div className="text-slate-500">{item.icon}</div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="truncate text-lg font-semibold text-slate-950">{item.value}</p>
            </div>
            <IconLink label={`Update ${item.label}`} href={item.href}>
              <Plus className="h-4 w-4" />
            </IconLink>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function StatPill({
  icon,
  value,
  label,
  accent,
  accentClassName,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  accent: string;
  accentClassName: string;
}) {
  return (
    <div className="crm-dashboard-stat flex items-center gap-4 rounded-[28px] bg-white/28 p-4 backdrop-blur">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5 text-slate-950">{icon}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-xl font-semibold text-slate-950">{value}</p>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${accentClassName}`}>{accent}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function controlClassName() {
  return "flex h-11 w-11 items-center justify-center rounded-full border border-[#ABB7C0]/30 bg-white/55 text-[#0B0F15] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E5EC9]/20";
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={controlClassName()}>
      {children}
    </button>
  );
}

function MenuButton({
  label,
  items,
  buttonClassName = "",
}: {
  label: string;
  items: MenuItem[];
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        className={`${controlClassName()} ${buttonClassName}`}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-40 w-60 overflow-hidden rounded-[22px] border border-[#ABB7C0]/25 bg-[#FDFDFD] p-2 text-left shadow-[0_24px_60px_rgba(11,15,21,0.16)]">
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="block rounded-2xl px-3 py-2 text-sm font-semibold text-[#25425E] transition hover:bg-[#E9D7A1]/35 hover:text-[#0B0F15]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                className="block w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold text-[#25425E] transition hover:bg-[#E9D7A1]/35 hover:text-[#0B0F15] disabled:opacity-45"
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function IconLink({ label, children, href }: { label: string; children: ReactNode; href: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={controlClassName()}>
      {children}
    </Link>
  );
}

function IconAnchor({ label, children, href }: { label: string; children: ReactNode; href: string }) {
  return (
    <a href={href} aria-label={label} title={label} className={controlClassName()}>
      {children}
    </a>
  );
}

function AvatarStack({ names }: { names: string[] }) {
  return (
    <div className="flex -space-x-2">
      {names.slice(0, 4).map((name) => (
        <span
          key={name}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#efd6c8] text-[10px] font-black text-slate-950"
        >
          {initials(name)}
        </span>
      ))}
    </div>
  );
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function tasksForDay(tasks: Task[], year: number, monthIndex: number, day: number) {
  return tasks
    .filter((task) => {
      const due = new Date(task.due_date);
      return due.getFullYear() === year && due.getMonth() === monthIndex && due.getDate() === day && task.status !== "completed";
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
}

function formatLocalDate(year: number, monthIndex: number, day: number) {
  const month = `${monthIndex + 1}`.padStart(2, "0");
  const date = `${day}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function buildPortfolioAlerts(data: CrmData): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];
  const now = Date.now();

  for (const deal of data.deals.filter((item) => item.approval_status === "pending").slice(0, 2)) {
    const merchant = data.merchants.find((item) => item.id === deal.merchant_id);
    alerts.push({
      title: "Pricing approval needed",
      helper: `${merchant?.business_name ?? "Merchant"} is below pricing floor at ${deal.proposed_rate}%.`,
      href: "/opportunities#approval-requests",
      merchantId: merchant?.id,
      tone: "amber",
    });
  }

  for (const merchant of data.merchants.filter((item) => item.status === "underwriting").slice(0, 2)) {
    const docs = data.documents.filter((document) => document.merchant_id === merchant.id);
    if (docs.length < 2) {
      alerts.push({
        title: "Underwriting docs thin",
        helper: `${merchant.business_name} has ${docs.length} document${docs.length === 1 ? "" : "s"} attached. Verify statements, owner ID, and voided check.`,
        href: `/merchants/${merchant.id}`,
        merchantId: merchant.id,
        tone: "blue",
      });
    }
  }

  const overdueTask = data.tasks
    .filter((task) => task.status !== "completed" && new Date(task.due_date).getTime() < now)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
  if (overdueTask) {
    const merchant = overdueTask.merchant_id ? data.merchants.find((item) => item.id === overdueTask.merchant_id) : null;
    alerts.push({
      title: "Overdue follow-up",
      helper: `${overdueTask.title} was due ${new Date(overdueTask.due_date).toLocaleDateString()}${merchant ? ` for ${merchant.business_name}` : ""}.`,
      href: overdueTask.merchant_id ? `/tasks?merchant=${overdueTask.merchant_id}` : "/tasks",
      merchantId: overdueTask.merchant_id ?? undefined,
      tone: "rose",
    });
  }

  const unsigned = data.signatureRequests.find((request) => !["signed", "declined", "expired"].includes(request.status));
  if (unsigned) {
    alerts.push({
      title: "Signature still open",
      helper: `${unsigned.title} is ${unsigned.status} for ${unsigned.recipient_name}.`,
      href: "/documents",
      merchantId: unsigned.related_entity_type === "merchant" ? unsigned.related_entity_id ?? undefined : undefined,
      tone: "slate",
    });
  }

  const importIssue = data.residualImportBatches.find((batch) => batch.error_count > 0);
  if (importIssue) {
    alerts.push({
      title: "Residual import exceptions",
      helper: `${importIssue.error_count} row${importIssue.error_count === 1 ? "" : "s"} need review from ${importIssue.processor_name}.`,
      href: "/reports",
      tone: "rose",
    });
  }

  const residualVariance = findResidualVarianceAlert(data);
  if (residualVariance) alerts.push(residualVariance);

  return alerts.slice(0, 4);
}

function findResidualVarianceAlert(data: CrmData): PortfolioAlert | null {
  for (const merchant of data.merchants.filter((item) => item.status === "processing")) {
    const latestResidual = data.residuals
      .filter((residual) => residual.merchant_id === merchant.id)
      .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0];
    if (!latestResidual || !merchant.monthly_volume_estimate) continue;

    const variance = latestResidual.processing_volume / merchant.monthly_volume_estimate;
    if (variance < 0.7 || variance > 1.3) {
      return {
        title: "Volume variance watch",
        helper: `${merchant.business_name} processed ${currency(latestResidual.processing_volume)} vs ${currency(merchant.monthly_volume_estimate)} expected.`,
        href: `/merchants/${merchant.id}`,
        merchantId: merchant.id,
        tone: variance < 0.7 ? "rose" : "amber",
      };
    }
  }

  return null;
}

function alertToneClass(tone: PortfolioAlert["tone"]) {
  if (tone === "blue") return "bg-[#0E5EC9] text-white";
  if (tone === "amber") return "bg-[#E9D7A1] text-[#0B0F15]";
  if (tone === "rose") return "bg-[#D57D25] text-white";
  return "bg-[#25425E] text-white";
}
