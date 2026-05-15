"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Download, RefreshCcw, ShieldCheck, WalletCards } from "lucide-react";
import {
  connectPayrollIntegrationAction,
  disconnectPayrollIntegrationAction,
  generatePayrollExportAction,
  syncPayrollIntegrationAction,
} from "@/lib/actions";
import { payrollProviders } from "@/lib/payroll";
import type { CrmData, PayrollProviderId } from "@/lib/types";
import { currency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";

type PayrollPayload = {
  filename: string;
  csv: string;
  rows: unknown[];
  totals: {
    grossCommissions: number;
    adjustments: number;
    adjustmentsTotal: number;
    totalPayout: number;
  };
};

export function PayrollWorkspace({ data }: { data: CrmData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [lastExport, setLastExport] = useState<PayrollPayload | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: defaultMonthStart(),
    dateTo: new Date().toISOString().slice(0, 10),
    teamId: "all",
    agentId: "all",
    status: "all",
    provider: "manual" as PayrollProviderId,
    format: "csv",
  });
  const [connection, setConnection] = useState({
    provider: "stripe" as PayrollProviderId,
    display_name: "Stripe payout workspace",
    account_identifier: "",
    apiKey: "",
    accountId: "",
    webhookSecret: "",
  });
  const provider = payrollProviders.find((item) => item.id === connection.provider) ?? payrollProviders[0];
  const totalPayroll = data.residuals.reduce((sum, item) => sum + item.agent_residual_amount, 0) +
    data.payrollAdjustments.filter((adjustment) => adjustment.status !== "void").reduce((sum, item) => sum + item.amount, 0);
  const providers = useMemo(() => payrollProviders, []);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value as never }));
  }

  function updateConnection(key: keyof typeof connection, value: string) {
    setConnection((current) => ({ ...current, [key]: value as never }));
  }

  function generateExport() {
    startTransition(async () => {
      const result = await generatePayrollExportAction(filters);
      setMessage(result.message);
      if (result.ok && result.data) {
        const payload = result.data as PayrollPayload;
        setLastExport(payload);
        downloadCsv(payload.filename, payload.csv);
        router.refresh();
      }
    });
  }

  function connectProvider() {
    startTransition(async () => {
      const result = await connectPayrollIntegrationAction({
        provider: connection.provider,
        display_name: connection.display_name,
        account_identifier: connection.account_identifier,
        credentials: {
          apiKey: connection.apiKey,
          accountId: connection.accountId,
          webhookSecret: connection.webhookSecret,
        },
      });
      setMessage(result.message);
      if (result.ok) {
        setConnection((current) => ({ ...current, apiKey: "", webhookSecret: "", account_identifier: "", accountId: "" }));
        router.refresh();
      }
    });
  }

  function syncIntegration(integrationId: string) {
    startTransition(async () => {
      const result = await syncPayrollIntegrationAction({ integration_id: integrationId });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function disconnectIntegration(integrationId: string) {
    startTransition(async () => {
      const result = await disconnectPayrollIntegrationAction({ integration_id: integrationId });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section id="payroll" className="grid gap-6 xl:col-span-3 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Payroll Export</CardTitle>
              <CardDescription>Generate payout-ready commission files by date, team, and agent.</CardDescription>
            </div>
            <Badge tone="blue">
              <ShieldCheck className="h-3.5 w-3.5" />
              Finance-only
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="From">
              <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            </Field>
            <Field label="Provider">
              <Select value={filters.provider} onChange={(event) => updateFilter("provider", event.target.value)}>
                {providers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Team">
              <Select value={filters.teamId} onChange={(event) => updateFilter("teamId", event.target.value)}>
                <option value="all">All teams</option>
                {data.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    Team {team.team_number}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Agent">
              <Select value={filters.agentId} onChange={(event) => updateFilter("agentId", event.target.value)}>
                <option value="all">All agents</option>
                {data.agents.map((agent) => {
                  const profile = data.profiles.find((item) => item.id === agent.profile_id);
                  return (
                    <option key={agent.id} value={agent.id}>
                      {profile?.full_name ?? agent.agent_code}
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="all">All payout statuses</option>
                <option value="pending">Pending</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-3 sm:grid-cols-3">
              <PayrollStat label="Payroll basis" value={currency(lastExport?.totals.grossCommissions ?? totalPayroll)} />
              <PayrollStat label="Adjustments" value={currency(lastExport?.totals.adjustmentsTotal ?? data.payrollAdjustments.reduce((sum, item) => sum + item.amount, 0))} />
              <PayrollStat label="Total payout" value={currency(lastExport?.totals.totalPayout ?? totalPayroll)} />
            </div>
            <Button onClick={generateExport} disabled={isPending}>
              <Download className="h-4 w-4" />
              Export Payroll CSV
            </Button>
          </div>
          {message ? <p className="crm-panel rounded-2xl p-3 text-sm font-semibold text-[#25425E]">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Integrations</CardTitle>
          <CardDescription>Connect payout services through a provider adapter boundary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3">
            <Field label="Provider">
              <Select value={connection.provider} onChange={(event) => updateConnection("provider", event.target.value)}>
                {providers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Display name">
              <Input value={connection.display_name} onChange={(event) => updateConnection("display_name", event.target.value)} />
            </Field>
            <Field label="Account identifier">
              <Input value={connection.account_identifier} onChange={(event) => updateConnection("account_identifier", event.target.value)} placeholder="Stripe account, Gusto company, or payroll batch owner" />
            </Field>
            {(provider.requiredFields as string[]).includes("apiKey") ? (
              <Field label="API key">
                <Input type="password" value={connection.apiKey} onChange={(event) => updateConnection("apiKey", event.target.value)} placeholder="Stored encrypted" />
              </Field>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Account ID">
                <Input value={connection.accountId} onChange={(event) => updateConnection("accountId", event.target.value)} />
              </Field>
              <Field label="Webhook secret">
                <Input type="password" value={connection.webhookSecret} onChange={(event) => updateConnection("webhookSecret", event.target.value)} />
              </Field>
            </div>
            <Button onClick={connectProvider} disabled={isPending || !connection.display_name || !connection.account_identifier}>
              <CreditCard className="h-4 w-4" />
              Connect Provider
            </Button>
          </div>

          <div className="space-y-2">
            {data.payrollIntegrations.map((integration) => (
              <div key={integration.id} className="crm-panel rounded-[24px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0B0F15]">{integration.display_name}</p>
                    <p className="mt-1 text-sm text-[#25425E]/70">{integration.provider} · {integration.account_identifier}</p>
                  </div>
                  <Badge tone={integration.status === "connected" ? "blue" : integration.status === "error" ? "rose" : "slate"}>{integration.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => syncIntegration(integration.id)} disabled={isPending || integration.status === "disconnected"}>
                    <RefreshCcw className="h-4 w-4" />
                    Sync
                  </Button>
                  <Button variant="ghost" onClick={() => disconnectIntegration(integration.id)} disabled={isPending || integration.status === "disconnected"}>
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
            {!data.payrollIntegrations.length ? (
              <div className="crm-panel rounded-[24px] p-4 text-sm leading-6 text-[#25425E]">
                <WalletCards className="mr-2 inline h-4 w-4 text-[#0E5EC9]" />
                No payroll providers connected yet. Manual exports work without a provider.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function PayrollStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-panel rounded-2xl p-3">
      <p className="text-xs font-black uppercase text-[#25425E]/60">{label}</p>
      <p className="mt-1 font-black text-[#0B0F15]">{value}</p>
    </div>
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function defaultMonthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}
