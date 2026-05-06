"use client";

/* eslint-disable react-hooks/incompatible-library -- TanStack Table intentionally returns function accessors that React Compiler skips. */

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Building2, CheckCircle2, FileText, Mail, Phone, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { createMerchantAction, updateMerchantStatusAction } from "@/lib/actions";
import { requiresManagementApproval } from "@/lib/compensation";
import { pipelineStages } from "@/lib/demo-data";
import type { CrmData, Merchant, MerchantStatus, Profile } from "@/lib/types";
import { currency, daysBetween, percent, titleCase } from "@/lib/utils";

type FormState = {
  business_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  industry: string;
  monthly_volume_estimate: string;
  average_ticket: string;
  current_processor: string;
  proposed_rate: string;
  status: MerchantStatus;
  assigned_agent_id: string;
  notes: string;
};

const blankForm: FormState = {
  business_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  industry: "",
  monthly_volume_estimate: "",
  average_ticket: "",
  current_processor: "",
  proposed_rate: "1.65",
  status: "lead",
  assigned_agent_id: "",
  notes: "",
};

export function MerchantManager({
  data,
  currentProfile,
  currentAgentId,
}: {
  data: CrmData;
  currentProfile: Profile;
  currentAgentId: string;
}) {
  const [merchants, setMerchants] = useState(data.merchants);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedId, setSelectedId] = useState(data.merchants[0]?.id ?? "");
  const [form, setForm] = useState<FormState>(blankForm);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const agentsById = useMemo(
    () =>
      new Map(
        data.agents.map((agent) => {
          const profile = data.profiles.find((item) => item.id === agent.profile_id);
          return [agent.id, profile?.full_name ?? agent.agent_code];
        }),
      ),
    [data.agents, data.profiles],
  );
  const agentOptions = data.agents.map((agent) => {
    const profile = data.profiles.find((item) => item.id === agent.profile_id);
    return { id: agent.id, label: profile?.full_name ?? agent.agent_code };
  });
  const effectiveAssignedAgentId = currentProfile.role === "agent" ? currentAgentId : form.assigned_agent_id || currentAgentId;

  const columns = useMemo<ColumnDef<Merchant>[]>(
    () => [
      {
        accessorKey: "business_name",
        header: "Merchant",
        cell: ({ row }) => (
          <div className="space-y-1">
            <button
              className="block text-left font-medium text-slate-950 hover:text-emerald-700 dark:text-white"
              onClick={() => setSelectedId(row.original.id)}
            >
              {row.original.business_name}
              <span className="block text-xs font-normal text-slate-500">{row.original.industry}</span>
            </button>
            <Link className="text-xs font-medium text-emerald-700 hover:text-emerald-800" href={`/merchants/${row.original.id}`}>
              Open profile
            </Link>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "assigned_agent_id",
        header: "Agent",
        cell: ({ row }) => agentsById.get(row.original.assigned_agent_id),
      },
      {
        accessorKey: "monthly_volume_estimate",
        header: "Volume",
        cell: ({ row }) => currency(row.original.monthly_volume_estimate),
      },
      {
        accessorKey: "proposed_rate",
        header: "Rate",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {percent(row.original.proposed_rate)}
            {requiresManagementApproval(row.original.proposed_rate) ? <Badge tone="amber">Approval</Badge> : null}
          </div>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Age",
        cell: ({ row }) => `${daysBetween(row.original.updated_at)}d`,
      },
    ],
    [agentsById],
  );

  const table = useReactTable({
    data: merchants,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedMerchant = merchants.find((merchant) => merchant.id === selectedId) ?? merchants[0];

  function updateField<TKey extends keyof FormState>(key: TKey, value: FormState[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addMerchant() {
    if (!form.business_name.trim() || !form.contact_name.trim()) {
      return;
    }

    const merchant: Merchant = {
      id: `merchant-${crypto.randomUUID()}`,
      business_name: form.business_name.trim(),
      contact_name: form.contact_name.trim(),
      contact_email: form.contact_email.trim(),
      contact_phone: form.contact_phone.trim(),
      business_address: "",
      industry: form.industry.trim() || "Uncategorized",
      monthly_volume_estimate: Number(form.monthly_volume_estimate) || 0,
      average_ticket: Number(form.average_ticket) || 0,
      current_processor: form.current_processor.trim() || "Unknown",
      proposed_rate: Number(form.proposed_rate) || 0,
      status: form.status,
      assigned_agent_id: effectiveAssignedAgentId,
      processing_start_date: null,
      is_verified: false,
      notes: form.notes.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    startTransition(async () => {
      const result = await createMerchantAction({
        ...form,
        monthly_volume_estimate: Number(form.monthly_volume_estimate) || 0,
        average_ticket: Number(form.average_ticket) || 0,
        proposed_rate: Number(form.proposed_rate) || 0,
        assigned_agent_id: effectiveAssignedAgentId,
      });

      setMessage(result.message);
      if (result.ok) {
        const savedMerchant = result.data as Merchant | undefined;
        setMerchants((current) => [savedMerchant ?? merchant, ...current]);
        setSelectedId(savedMerchant?.id ?? merchant.id);
        setForm(blankForm);
      }
    });
  }

  function updateSelectedStatus(status: MerchantStatus) {
    if (!selectedMerchant) return;
    const merchantId = selectedMerchant.id;

    setMerchants((current) =>
      current.map((merchant) =>
        merchant.id === merchantId
          ? { ...merchant, status, updated_at: new Date().toISOString() }
          : merchant,
      ),
    );
    startTransition(async () => {
      const result = await updateMerchantStatusAction(merchantId, status);
      setMessage(result.message);
    });
  }

  return (
    <section id="merchants" className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Merchant Book</CardTitle>
              <CardDescription>Search, sort, add, and update merchant accounts.</CardDescription>
            </div>
            <div className="flex gap-2">
              <label className="relative block w-full min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  value={globalFilter}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  placeholder="Filter merchant table"
                />
              </label>
              <Button variant="secondary" size="icon" aria-label="Table controls">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {table.getRowModel().rows.length ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th key={header.id} className="px-4 py-3 font-semibold">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/70">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Building2 className="h-5 w-5" />}
              title="No merchants found"
              description="Adjust your filter or add the first merchant in this book."
            />
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Merchant</CardTitle>
            <CardDescription>Fast lead capture for agents in the field.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="Business name">
                <Input value={form.business_name} onChange={(event) => updateField("business_name", event.target.value)} placeholder="ABC Grocery" />
              </Field>
              <Field label="Contact">
                <Input value={form.contact_name} onChange={(event) => updateField("contact_name", event.target.value)} placeholder="Primary contact" />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.contact_email} onChange={(event) => updateField("contact_email", event.target.value)} placeholder="owner@example.com" />
              </Field>
              <Field label="Phone">
                <Input value={form.contact_phone} onChange={(event) => updateField("contact_phone", event.target.value)} placeholder="(716) 555-0100" />
              </Field>
              <Field label="Monthly volume">
                <Input type="number" value={form.monthly_volume_estimate} onChange={(event) => updateField("monthly_volume_estimate", event.target.value)} placeholder="45000" />
              </Field>
              <Field label="Proposed rate">
                <Input type="number" step="0.01" value={form.proposed_rate} onChange={(event) => updateField("proposed_rate", event.target.value)} />
              </Field>
              <Field label="Industry">
                <Input value={form.industry} onChange={(event) => updateField("industry", event.target.value)} placeholder="Restaurant" />
              </Field>
              <Field label="Current processor">
                <Input value={form.current_processor} onChange={(event) => updateField("current_processor", event.target.value)} placeholder="Fiserv, Square, Stripe" />
              </Field>
              {currentProfile.role !== "agent" ? (
                <Field label="Assigned agent">
                  <Select value={effectiveAssignedAgentId} onChange={(event) => updateField("assigned_agent_id", event.target.value)}>
                    {agentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => updateField("status", event.target.value as MerchantStatus)}>
                {pipelineStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="What did they ask for? What is the next step?" />
            </Field>
            {message ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {message}
              </p>
            ) : null}
            <Button className="w-full" onClick={addMerchant} disabled={isPending}>
              <Plus className="h-4 w-4" />
              Create Merchant
            </Button>
          </CardContent>
        </Card>

        {selectedMerchant ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{selectedMerchant.business_name}</CardTitle>
                  <CardDescription>{selectedMerchant.industry} account profile</CardDescription>
                </div>
                <StatusBadge status={selectedMerchant.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm">
                <ProfileLine icon={<Phone className="h-4 w-4" />} label={selectedMerchant.contact_name} value={selectedMerchant.contact_phone} />
                <ProfileLine icon={<Mail className="h-4 w-4" />} label="Email" value={selectedMerchant.contact_email || "Missing"} />
                <ProfileLine icon={<FileText className="h-4 w-4" />} label="Processor" value={selectedMerchant.current_processor} />
                <ProfileLine icon={<CheckCircle2 className="h-4 w-4" />} label="Residual estimate" value={currency(selectedMerchant.monthly_volume_estimate * (selectedMerchant.proposed_rate / 100) * 0.28)} />
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                {selectedMerchant.notes || "No notes yet."}
              </div>
              <Field label="Move deal stage">
                <Select value={selectedMerchant.status} onChange={(event) => updateSelectedStatus(event.target.value as MerchantStatus)}>
                  {pipelineStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ProfileLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3 dark:border-slate-800">
      <span className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="min-w-0 truncate text-right font-medium text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: MerchantStatus }) {
  const tone = status === "processing" || status === "approved" ? "emerald" : status === "underwriting" ? "amber" : status === "lost" ? "rose" : "blue";
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}
