"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Edit3,
  ExternalLink,
  Mail,
  Maximize2,
  MoreHorizontal,
  Phone,
  Plus,
  Share2,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { pipelineStages } from "@/lib/demo-data";
import type { CrmData, Deal, Merchant } from "@/lib/types";
import { currency, daysBetween, titleCase } from "@/lib/utils";

type InteractionCard = {
  deal: Deal | null;
  merchant: Merchant;
  value: number;
};

const dealPalettes = [
  {
    card: "bg-[#3157f6] text-white shadow-[0_20px_42px_rgba(49,87,246,0.24)]",
    muted: "text-blue-100",
    chip: "bg-white/12 text-white",
  },
  {
    card: "bg-[#4f9caf] text-white shadow-[0_20px_42px_rgba(79,156,175,0.22)]",
    muted: "text-cyan-50",
    chip: "bg-white/15 text-white",
  },
  {
    card: "bg-black text-white shadow-[0_22px_48px_rgba(0,0,0,0.20)]",
    muted: "text-slate-300",
    chip: "bg-white/12 text-white",
  },
  {
    card: "bg-[#f7eb31] text-slate-950 shadow-[0_20px_42px_rgba(247,235,49,0.20)]",
    muted: "text-slate-700",
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
  const cards = useMemo<InteractionCard[]>(() => {
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

    if (source.length) return source.slice(0, 6);

    return data.merchants.slice(0, 6).map((merchant) => ({
      deal: null,
      merchant,
      value: merchant.monthly_volume_estimate,
    }));
  }, [data.deals, data.merchants]);

  const [selectedMerchantId, setSelectedMerchantId] = useState(cards[0]?.merchant.id ?? data.merchants[0]?.id ?? "");
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
  const activeTasks = data.tasks.filter((task) => task.status !== "completed").length;
  const recentMerchants = data.merchants.filter((merchant) => daysBetween(merchant.created_at) <= 7).length;
  const totalWonResidual = data.residuals.reduce((sum, residual) => sum + residual.net_residual, 0);

  const stageRows = pipelineStages
    .map((stage) => {
      const stageDeals = data.deals.filter((deal) => deal.stage === stage.id);
      const total = stageDeals.reduce((sum, deal) => sum + deal.estimated_monthly_volume, 0);
      return { ...stage, total, count: stageDeals.length };
    })
    .filter((stage) => stage.total > 0 || stage.count > 0);
  const largestStage = Math.max(...stageRows.map((stage) => stage.total), 1);

  return (
    <section id="dashboard" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatPill
            icon={<Share2 className="h-5 w-5" />}
            value={currency(totalWonResidual || processingVolume)}
            label="Won from live deals"
            accent="+11% week"
            accentClassName="bg-[#f7eb31] text-slate-950"
          />
          <StatPill
            icon={<UserRound className="h-5 w-5" />}
            value={`+${recentMerchants || data.merchants.length}`}
            label="New customers"
            accent="+12 today"
            accentClassName="bg-[#3157f6] text-white"
          />
          <StatPill
            icon={<ClipboardList className="h-5 w-5" />}
            value={`+${activeTasks}`}
            label="New tasks"
            accent="+6 today"
            accentClassName="bg-white/70 text-slate-700"
          />
        </div>

        <Panel
          title="Interaction History"
          actions={
            <>
              <IconButton label="More history">
                <MoreHorizontal className="h-4 w-4" />
              </IconButton>
              <IconButton label="Open opportunities">
                <ArrowUpRight className="h-4 w-4" />
              </IconButton>
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
                onSelect={() => setSelectedMerchantId(card.merchant.id)}
              />
            ))}
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel
            title="Tasks Schedule"
            actions={
              <>
                <IconButton label="Previous week">
                  <ArrowLeft className="h-4 w-4" />
                </IconButton>
                <IconButton label="Next week">
                  <ArrowRight className="h-4 w-4" />
                </IconButton>
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-2xl font-semibold">October</p>
              <IconButton label="Expand schedule">
                <Maximize2 className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 21 }, (_, item) => item + 1).map((day) => {
                const task = data.tasks[day % Math.max(data.tasks.length, 1)];
                const active = [4, 11, 12, 16].includes(day);
                const color =
                  day === 4
                    ? "bg-[#3157f6] text-white"
                    : day === 11
                      ? "bg-[#f7eb31] text-slate-950"
                      : day === 16
                        ? "bg-[#4f9caf] text-white"
                        : day === 12
                          ? "bg-[#eadca0] text-slate-950"
                          : "bg-white/32 text-slate-500";

                return (
                  <div key={day} className={`min-h-20 rounded-2xl p-2 text-xs ${color}`}>
                    <div className="flex items-center justify-between">
                      <span>{day}</span>
                      {active ? <AvatarStack names={[task?.title ?? "Task", selectedMerchant?.contact_name ?? "Merchant"]} /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Stage Funnel"
            actions={
              <>
                <IconButton label="Funnel menu">
                  <MoreHorizontal className="h-4 w-4" />
                </IconButton>
                <IconButton label="Expand funnel">
                  <ArrowUpRight className="h-4 w-4" />
                </IconButton>
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold">{currency(pipelineValue)}</p>
                <p className="text-sm text-slate-500">Total in pipeline</p>
              </div>
              <div className="rounded-full bg-white/45 p-1 text-sm font-semibold">
                <span className="inline-flex rounded-full bg-black px-4 py-2 text-white">Weighted</span>
                <span className="inline-flex px-4 py-2 text-slate-500">Total</span>
              </div>
            </div>
            <div className="space-y-3">
              {stageRows.slice(0, 5).map((stage) => (
                <div key={stage.id} className="rounded-3xl bg-white/35 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">{stage.label}</span>
                    <span className="font-semibold">{currency(stage.total)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/55">
                    <div
                      className="h-3 rounded-full bg-black"
                      style={{ width: `${Math.max(10, Math.round((stage.total / largestStage) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
              {!stageRows.length ? <p className="text-sm text-slate-500">No active pipeline stages yet.</p> : null}
            </div>
          </Panel>
        </div>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
        <CustomerCard merchant={selectedMerchant} deal={selectedDeal} />
        <DetailCard merchant={selectedMerchant} agentName={selectedProfile?.full_name ?? "Unassigned"} />
      </aside>
    </section>
  );
}

function Panel({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[34px] border border-white/55 bg-white/38 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function OpportunityTile({
  card,
  palette,
  selected,
  onSelect,
}: {
  card: InteractionCard;
  palette: (typeof dealPalettes)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const date = card.deal?.expected_close_date
    ? new Date(card.deal.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : new Date(card.merchant.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`min-h-44 rounded-[24px] p-5 text-left transition hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-black/30 ${palette.card} ${
        selected ? "ring-2 ring-black/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${palette.muted}`}>{date}</p>
          <h3 className="mt-3 max-w-[14rem] text-base font-semibold leading-5">{card.merchant.business_name}</h3>
          <p className={`mt-1 text-sm ${palette.muted}`}>{titleCase(card.deal?.stage ?? card.merchant.status)}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${palette.chip}`}>
          <MoreHorizontal className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-7 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold">{currency(card.value)}</p>
        <AvatarStack names={[card.merchant.contact_name, card.merchant.business_name, card.merchant.industry]} />
      </div>
    </button>
  );
}

function CustomerCard({ merchant, deal }: { merchant?: Merchant; deal: Deal | null }) {
  if (!merchant) {
    return (
      <Panel title="Customer">
        <p className="text-sm text-slate-500">Add a merchant to populate the customer workspace.</p>
      </Panel>
    );
  }

  return (
    <div className="rounded-[34px] border border-white/55 bg-white/38 p-6 text-center shadow-[0_20px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-2">
          <IconButton label="Share contact">
            <Share2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Filter actions">
            <SlidersHorizontal className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex gap-2">
          <IconButton label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
          <Link
            href={`/merchants/${merchant.id}`}
            aria-label={`Open ${merchant.business_name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/35 text-slate-950 transition hover:bg-white/65"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#fff_0,#fff_24%,#f5a3bc_25%,#f5a3bc_52%,#3157f6_53%,#3157f6_100%)] text-3xl font-black text-white shadow-[0_18px_45px_rgba(49,87,246,0.18)]">
        {initials(merchant.contact_name || merchant.business_name)}
      </div>
      <h2 className="mt-6 text-2xl font-black text-slate-950">{merchant.contact_name || merchant.business_name}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-5 text-slate-500">
        {merchant.industry || "Merchant"} contact at {merchant.business_name}
      </p>
      <Badge className="mt-4 rounded-full border-black/10 bg-white/45 text-slate-700">
        {titleCase(deal?.stage ?? merchant.status)}
      </Badge>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <IconButton label="Edit merchant">
          <Edit3 className="h-4 w-4" />
        </IconButton>
        <IconButton label="Email merchant">
          <Mail className="h-4 w-4" />
        </IconButton>
        <IconButton label="Call merchant">
          <Phone className="h-4 w-4" />
        </IconButton>
        <IconButton label="Add task">
          <Plus className="h-4 w-4" />
        </IconButton>
        <IconButton label="Schedule follow up">
          <CalendarDays className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

function DetailCard({ merchant, agentName }: { merchant?: Merchant; agentName: string }) {
  if (!merchant) return null;

  const details = [
    { icon: <UserRound className="h-4 w-4" />, label: "Business", value: merchant.business_name },
    { icon: <Mail className="h-4 w-4" />, label: "Email", value: merchant.contact_email || "Missing" },
    { icon: <Phone className="h-4 w-4" />, label: "Phone", value: merchant.contact_phone || "Missing" },
    { icon: <UsersRound className="h-4 w-4" />, label: "Assigned agent", value: agentName },
    { icon: <CalendarDays className="h-4 w-4" />, label: "Last contacted", value: new Date(merchant.updated_at).toLocaleString() },
  ];

  return (
    <Panel
      title="Detailed Information"
      actions={
        <>
          <IconButton label="Edit details">
            <Edit3 className="h-4 w-4" />
          </IconButton>
          <Link
            href={`/merchants/${merchant.id}`}
            aria-label={`Open ${merchant.business_name} details`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/35 text-slate-950 transition hover:bg-white/65"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {details.map((item) => (
          <div key={item.label} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3">
            <div className="text-slate-500">{item.icon}</div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="truncate text-lg font-semibold text-slate-950">{item.value}</p>
            </div>
            <IconButton label={`Update ${item.label}`}>
              <Plus className="h-4 w-4" />
            </IconButton>
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
  icon: React.ReactNode;
  value: string;
  label: string;
  accent: string;
  accentClassName: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[28px] bg-white/28 p-4 backdrop-blur">
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

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/35 text-slate-950 transition hover:bg-white/65"
    >
      {children}
    </button>
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
