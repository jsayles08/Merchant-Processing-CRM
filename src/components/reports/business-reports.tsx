import { AlertTriangle, BarChart3, CircleDollarSign, UsersRound } from "lucide-react";
import type { CrmData, Profile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResidualImporter } from "@/components/reports/residual-importer";
import { currency, daysBetween, percent } from "@/lib/utils";

export function BusinessReports({ data, currentProfile }: { data: CrmData; currentProfile: Profile }) {
  const agentRows = data.agents.map((agent) => {
    const profile = data.profiles.find((item) => item.id === agent.profile_id);
    const merchants = data.merchants.filter((merchant) => merchant.assigned_agent_id === agent.id);
    const residual = data.residuals
      .filter((item) => item.agent_id === agent.id)
      .reduce((sum, item) => sum + item.net_residual, 0);
    const pipeline = data.deals
      .filter((deal) => deal.agent_id === agent.id && !["processing", "lost", "inactive"].includes(deal.stage))
      .reduce((sum, deal) => sum + deal.estimated_monthly_volume, 0);
    return {
      id: agent.id,
      name: profile?.full_name ?? agent.agent_code,
      merchants: merchants.length,
      residual,
      payout: residual * (data.compensationRule.base_residual_percentage / 100),
      pipeline,
    };
  });

  const staleLeads = data.merchants
    .filter((merchant) => !["processing", "lost", "inactive"].includes(merchant.status) && daysBetween(merchant.updated_at) >= 7)
    .sort((a, b) => daysBetween(b.updated_at) - daysBetween(a.updated_at));

  const totalResidual = data.residuals.reduce((sum, residual) => sum + residual.net_residual, 0);
  const totalPayout = data.residuals.reduce((sum, residual) => sum + residual.agent_residual_amount, 0);

  return (
    <section id="reports" className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Production Report</CardTitle>
              <CardDescription>Agent production, pipeline volume, and residual payout basis.</CardDescription>
            </div>
            <Badge tone="emerald">{currency(totalResidual)} net residual</Badge>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-3">Agent</th>
                <th className="py-3">Merchants</th>
                <th className="py-3">Pipeline</th>
                <th className="py-3">Net residual</th>
                <th className="py-3">Agent payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {agentRows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 font-medium">{row.name}</td>
                  <td className="py-3">{row.merchants}</td>
                  <td className="py-3">{currency(row.pipeline)}</td>
                  <td className="py-3">{currency(row.residual)}</td>
                  <td className="py-3">{currency(row.payout)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Summary icon={<CircleDollarSign className="h-4 w-4" />} label="Agent payout" value={currency(totalPayout)} />
            <Summary icon={<BarChart3 className="h-4 w-4" />} label="Company share" value={currency(totalResidual - totalPayout)} />
            <Summary icon={<UsersRound className="h-4 w-4" />} label="Agents" value={data.agents.length.toString()} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk & Follow-up Report</CardTitle>
          <CardDescription>Stale leads and high-value opportunities needing attention.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {staleLeads.map((merchant) => (
            <div key={merchant.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950 dark:text-white">{merchant.business_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{currency(merchant.monthly_volume_estimate)} monthly volume · {percent(merchant.proposed_rate)}</p>
                </div>
                <Badge tone="rose">{daysBetween(merchant.updated_at)}d stale</Badge>
              </div>
            </div>
          ))}
          {!staleLeads.length ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <AlertTriangle className="h-4 w-4" />
              No stale leads right now.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {currentProfile.role === "admin" ? <ResidualImporter /> : null}

      {currentProfile.role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent Imports</CardTitle>
            <CardDescription>Processor import batches and exception counts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.residualImportBatches.slice(0, 5).map((batch) => (
              <div key={batch.id} className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">{batch.processor_name}</p>
                    <p className="mt-1 text-slate-500">{batch.statement_month} · {batch.imported_count} imported · {batch.error_count} issues</p>
                  </div>
                  <Badge tone={batch.status === "completed" ? "emerald" : batch.status === "failed" ? "rose" : "amber"}>{batch.status}</Badge>
                </div>
                {batch.error_summary ? <p className="mt-3 whitespace-pre-line text-xs text-rose-600 dark:text-rose-300">{batch.error_summary}</p> : null}
              </div>
            ))}
            {!data.residualImportBatches.length ? <p className="text-sm text-slate-500">No processor imports yet.</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
      <p className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
