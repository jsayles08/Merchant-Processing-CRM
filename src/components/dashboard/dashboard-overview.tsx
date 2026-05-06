"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Banknote, BriefcaseBusiness, CircleDollarSign, HandCoins, TrendingUp, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import type { CrmData } from "@/lib/types";
import { compactNumber, currency, daysBetween } from "@/lib/utils";
import { calculateMonthlyAgentIncome } from "@/lib/compensation";

export function DashboardOverview({ data }: { data: CrmData }) {
  const [isMounted, setIsMounted] = useState(false);
  const processingVolume = data.residuals.reduce((sum, residual) => sum + residual.processing_volume, 0);
  const totalNetResidual = data.residuals.reduce((sum, residual) => sum + residual.net_residual, 0);
  const agentPayouts = data.residuals.reduce((sum, residual) => sum + residual.agent_residual_amount, 0);
  const companyShare = data.residuals.reduce((sum, residual) => sum + residual.company_share, 0);
  const activeAgents = data.agents.filter((agent) => agent.status === "active").length;
  const approvalRequests = data.deals.filter((deal) => deal.approval_status === "pending").length;
  const pipelineValue = data.deals.reduce((sum, deal) => sum + deal.estimated_monthly_volume, 0);
  const staleMerchants = data.merchants.filter((merchant) => daysBetween(merchant.updated_at) >= 7 && merchant.status !== "processing").length;
  const agentIncome = calculateMonthlyAgentIncome({
    agentId: "agent-1",
    residuals: data.residuals,
    teamMembers: data.teamMembers.filter((member) => member.sponsor_agent_id === "agent-1"),
    compensationRule: data.compensationRule,
  });

  const forecast = [
    { month: "Jan", volume: 260000, residual: 4300 },
    { month: "Feb", volume: 310000, residual: 5100 },
    { month: "Mar", volume: 382000, residual: 6200 },
    { month: "Apr", volume: processingVolume, residual: totalNetResidual },
    { month: "May", volume: pipelineValue * 0.32, residual: totalNetResidual + 1200 },
    { month: "Jun", volume: pipelineValue * 0.48, residual: totalNetResidual + 2150 },
  ];

  useEffect(() => {
    queueMicrotask(() => setIsMounted(true));
  }, []);

  const topAgents = data.agents.map((agent) => {
    const profile = data.profiles.find((item) => item.id === agent.profile_id);
    const agentMerchants = data.merchants.filter((merchant) => merchant.assigned_agent_id === agent.id);
    const residual = data.residuals
      .filter((item) => item.agent_id === agent.id)
      .reduce((sum, item) => sum + item.net_residual, 0);

    return {
      id: agent.id,
      name: profile?.full_name ?? "Unknown agent",
      merchants: agentMerchants.length,
      residual,
    };
  });

  return (
    <section id="dashboard" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total merchants" value={data.merchants.length.toString()} delta="+3 new this month" icon={<BriefcaseBusiness className="h-5 w-5" />} />
        <MetricCard label="Monthly volume" value={currency(processingVolume)} delta={`${compactNumber(pipelineValue)} in weighted pipeline`} icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard label="Net residual" value={currency(totalNetResidual)} delta={`${currency(agentPayouts)} agent payouts`} icon={<CircleDollarSign className="h-5 w-5" />} />
        <MetricCard label="Active agents" value={activeAgents.toString()} delta={`${approvalRequests} approvals pending`} icon={<UsersRound className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Revenue Forecast</CardTitle>
                <CardDescription>Processing volume and projected residual income by month.</CardDescription>
              </div>
              <Badge tone="emerald">Company share {currency(companyShare)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-80 min-w-0">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                  <Area type="monotone" dataKey="volume" stroke="#059669" fill="#a7f3d0" name="Volume" />
                  <Area type="monotone" dataKey="residual" stroke="#0f766e" fill="#ccfbf1" name="Residual" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartSkeleton />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Copilot Recommendations</CardTitle>
            <CardDescription>High-signal work for today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Insight icon={<AlertTriangle className="h-4 w-4" />} title="Rescue stale lead" body={`${staleMerchants} leads have no update in 7+ days. Start with Elm Street Books.`} />
            <Insight icon={<Banknote className="h-4 w-4" />} title="Pricing approval" body="Buffalo Auto Detail is below the 1.50% floor. Manager review is blocking underwriting." />
            <Insight icon={<HandCoins className="h-4 w-4" />} title="Agent estimate" body={`Jordan's demo income is ${currency(agentIncome.totalMonthlyIncome)} monthly, ${currency(agentIncome.annualizedIncomeEstimate)} annualized.`} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Agents</CardTitle>
            <CardDescription>Production ranked by active book and residual base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topAgents.map((agent, index) => (
              <div key={agent.id} className="flex items-center justify-between gap-4 rounded-md border border-slate-100 p-3 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold dark:bg-slate-900">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{agent.name}</p>
                    <p className="text-xs text-slate-500">{agent.merchants} merchants</p>
                  </div>
                </div>
                <p className="text-sm font-semibold">{currency(agent.residual)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stage Mix</CardTitle>
            <CardDescription>Pipeline distribution across acquisition stages.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 min-w-0">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.deals.map((deal) => ({ stage: deal.stage.replaceAll("_", " "), value: deal.estimated_monthly_volume }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="stage" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                  <Bar dataKey="value" fill="#047857" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartSkeleton />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-full items-end gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50">
      {[42, 58, 48, 72, 64, 84].map((height) => (
        <div key={height} className="flex flex-1 items-end">
          <div className="w-full rounded-t bg-slate-200 dark:bg-slate-800" style={{ height: `${height}%` }} />
        </div>
      ))}
    </div>
  );
}

function Insight({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-slate-100 p-3 dark:border-slate-800">
      <div className="mt-0.5 text-emerald-700 dark:text-emerald-300">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{body}</p>
      </div>
    </div>
  );
}
