"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { generateFinancialExportAction } from "@/lib/actions";
import type { CrmData } from "@/lib/types";
import { currency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";

type ExportPayload = {
  filename: string;
  csv: string;
  rows: unknown[];
  totals: {
    processingVolume: number;
    grossProcessingRevenue: number;
    processorCost: number;
    netResidual: number;
    agentPayout: number;
    companyShare: number;
  };
};

export function FinanceExporter({ data }: { data: CrmData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [lastExport, setLastExport] = useState<ExportPayload | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: defaultMonthStart(),
    dateTo: new Date().toISOString().slice(0, 10),
    teamId: "all",
    agentId: "all",
    status: "all",
    processor: "all",
    format: "csv",
  });
  const processors = useMemo(
    () => Array.from(new Set(data.merchants.map((merchant) => merchant.current_processor).filter(Boolean))).sort(),
    [data.merchants],
  );

  function update(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function generate() {
    startTransition(async () => {
      const result = await generateFinancialExportAction(filters);
      setMessage(result.message);
      if (result.ok && result.data) {
        const payload = result.data as ExportPayload;
        setLastExport(payload);
        downloadCsv(payload.filename, payload.csv);
        router.refresh();
      }
    });
  }

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>CPA Financial Export</CardTitle>
            <CardDescription>Generate normalized accounting exports with processor cost, residual, payout, and company-share totals.</CardDescription>
          </div>
          <Badge tone="blue">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin audited
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label="From">
            <Input type="date" value={filters.dateFrom} onChange={(event) => update("dateFrom", event.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={filters.dateTo} onChange={(event) => update("dateTo", event.target.value)} />
          </Field>
          <Field label="Team">
            <Select value={filters.teamId} onChange={(event) => update("teamId", event.target.value)}>
              <option value="all">All teams</option>
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  Team {team.team_number}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Agent">
            <Select value={filters.agentId} onChange={(event) => update("agentId", event.target.value)}>
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
            <Select value={filters.status} onChange={(event) => update("status", event.target.value)}>
              <option value="all">All statuses</option>
              {Array.from(new Set(data.merchants.map((merchant) => merchant.status))).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Processor">
            <Select value={filters.processor} onChange={(event) => update("processor", event.target.value)}>
              <option value="all">All processors</option>
              {processors.map((processor) => (
                <option key={processor} value={processor}>
                  {processor}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-3 sm:grid-cols-5">
            <ExportStat label="Rows" value={lastExport?.rows.length.toString() ?? data.residuals.length.toString()} />
            <ExportStat label="Processor cost" value={currency(lastExport?.totals.processorCost ?? data.residuals.reduce((sum, item) => sum + Number(item.processor_cost || 0), 0))} />
            <ExportStat label="Net residual" value={currency(lastExport?.totals.netResidual ?? data.residuals.reduce((sum, item) => sum + item.net_residual, 0))} />
            <ExportStat label="Agent payout" value={currency(lastExport?.totals.agentPayout ?? data.residuals.reduce((sum, item) => sum + item.agent_residual_amount, 0))} />
            <ExportStat label="Company share" value={currency(lastExport?.totals.companyShare ?? data.residuals.reduce((sum, item) => sum + item.company_share, 0))} />
          </div>
          <Button onClick={generate} disabled={isPending}>
            <Download className="h-4 w-4" />
            Generate CSV
          </Button>
        </div>

        {message ? <p className="crm-panel rounded-2xl p-3 text-sm font-semibold text-[#25425E]">{message}</p> : null}
        <div className="crm-panel rounded-[24px] p-4 text-sm leading-6 text-[#25425E]">
          <FileSpreadsheet className="mr-2 inline h-4 w-4 text-[#0E5EC9]" />
          Exports include a total row and are logged for audit review. XLSX can be enabled later by adding an XLSX library.
        </div>
      </CardContent>
    </Card>
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

function ExportStat({ label, value }: { label: string; value: string }) {
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
