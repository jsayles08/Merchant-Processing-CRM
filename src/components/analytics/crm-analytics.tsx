"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CheckCircle2, ClipboardList, TrendingUp, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CrmData } from "@/lib/types";
import { buildWorkflowAnalytics, type ChartDatum } from "@/lib/workflow-analytics";

const chartColors = ["#0E5EC9", "#25425E", "#E9D7A1", "#D57D25", "#0B0F15", "#88A6B6", "#C8D3D9", "#FDFDFD"];

export function CrmAnalytics({ data, compact = false }: { data: CrmData; compact?: boolean }) {
  const analytics = buildWorkflowAnalytics(data);
  const hasWorkflowData =
    data.agentRecruits.length ||
    data.agentOnboardingRecords.length ||
    data.merchantOnboardingRecords.length ||
    data.tasks.length;

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<UserPlus className="h-4 w-4" />} label="Recruits" value={analytics.metrics.totalRecruits} accent="+ pipeline" />
        <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Recruit conversion" value={`${analytics.metrics.recruitConversionRate}%`} accent="active agents" />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Agent onboarding" value={`${analytics.metrics.agentOnboardingCompletion}%`} accent="completion" />
        <MetricCard icon={<ClipboardList className="h-4 w-4" />} label="Pending follow-ups" value={analytics.metrics.pendingFollowUps} accent="tasks + workflows" />
      </div>

      {!hasWorkflowData ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Workflow analytics are ready"
          description="Add recruits, onboarding records, or merchant workflows to populate the charts."
        />
      ) : null}

      <div className={`grid gap-6 ${compact ? "xl:grid-cols-2" : "xl:grid-cols-[1.1fr_0.9fr]"}`}>
        <ChartCard title="Recruitment Pipeline" description="Agent recruits grouped by stage.">
          <StatusBarChart data={analytics.recruitStatus} />
        </ChartCard>

        <ChartCard title="Merchant Onboarding" description="Merchant onboarding records grouped by status.">
          <StatusPieChart data={analytics.merchantOnboardingStatus} />
        </ChartCard>
      </div>

      {!compact ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <ChartCard title="Agent Onboarding Completion" description="Current completion posture by onboarding status.">
            <StatusBarChart data={analytics.agentOnboardingStatus} horizontal />
          </ChartCard>

          <ChartCard title="Monthly Growth" description="New recruits and merchants created over the last six months.">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={analytics.monthlyWorkflow} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="recruitGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#0E5EC9" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#0E5EC9" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="merchantGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#D57D25" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="#D57D25" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ABB7C0" strokeOpacity={0.24} vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 18, border: "1px solid rgba(171,183,192,.35)" }} />
                <Area type="monotone" dataKey="recruits" stroke="#0E5EC9" fill="url(#recruitGradient)" strokeWidth={3} />
                <Area type="monotone" dataKey="merchants" stroke="#D57D25" fill="url(#merchantGradient)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card className="rounded-[26px]">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#25425E]/75">{label}</p>
          <p className="mt-1 text-3xl font-black text-[#0B0F15]">{value}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-[#0E5EC9] shadow-inner ring-1 ring-[#ABB7C0]/25">
            {icon}
          </span>
          <Badge tone="slate">{accent}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StatusBarChart({ data, horizontal = false }: { data: ChartDatum[]; horizontal?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 40 : -18, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="#ABB7C0" strokeOpacity={0.22} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" width={118} tickLine={false} axisLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={62} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          </>
        )}
        <Tooltip contentStyle={{ borderRadius: 18, border: "1px solid rgba(171,183,192,.35)" }} />
        <Bar dataKey="value" radius={[14, 14, 6, 6]}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatusPieChart({ data }: { data: ChartDatum[] }) {
  const visibleData = data.filter((item) => item.value > 0);

  if (!visibleData.length) {
    return (
      <div className="flex h-[260px] items-center justify-center">
        <p className="text-sm font-semibold text-[#25425E]/65">No merchant onboarding records yet.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={visibleData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={4}>
          {visibleData.map((entry, index) => (
            <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 18, border: "1px solid rgba(171,183,192,.35)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
