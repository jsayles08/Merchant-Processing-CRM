"use client";

/* eslint-disable react-hooks/incompatible-library -- TanStack Table intentionally returns function accessors that React Compiler skips. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Building2, CheckCircle2, Download, FileText, Mail, Phone, PlugZap, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { DeleteMerchantButton } from "@/components/merchants/delete-merchant-button";
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
  initialSearchQuery = "",
}: {
  data: CrmData;
  currentProfile: Profile;
  currentAgentId: string;
  initialSearchQuery?: string;
}) {
  const [merchants, setMerchants] = useState(data.merchants);
  const [globalFilter, setGlobalFilter] = useState(initialSearchQuery);
  const [selectedId, setSelectedId] = useState(data.merchants[0]?.id ?? "");
  const [form, setForm] = useState<FormState>(blankForm);
  const [showControls, setShowControls] = useState(false);
  const [stageFilter, setStageFilter] = useState<MerchantStatus | "all">("all");
  const [agentFilter, setAgentFilter] = useState("all");
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
  const defaultAssignedAgentId = currentAgentId || agentOptions[0]?.id || "";
  const effectiveAssignedAgentId =
    currentProfile.role === "agent" ? currentAgentId : form.assigned_agent_id || defaultAssignedAgentId;
  const filteredMerchants = useMemo(
    () =>
      merchants.filter((merchant) => {
        const matchesStage = stageFilter === "all" || merchant.status === stageFilter;
        const matchesAgent = agentFilter === "all" || merchant.assigned_agent_id === agentFilter;
        return matchesStage && matchesAgent;
      }),
    [agentFilter, merchants, stageFilter],
  );
  const hasActiveControls = Boolean(globalFilter || stageFilter !== "all" || agentFilter !== "all");
  const canDeleteMerchants = currentProfile.role !== "agent";

  const handleMerchantDeleted = useCallback(
    (merchantId: string, resultMessage: string) => {
      setMerchants((current) => current.filter((merchant) => merchant.id !== merchantId));
      setSelectedId((currentSelectedId) =>
        currentSelectedId === merchantId ? merchants.find((merchant) => merchant.id !== merchantId)?.id ?? "" : currentSelectedId,
      );
      setMessage(resultMessage);
    },
    [merchants],
  );

  const columns = useMemo<ColumnDef<Merchant>[]>(
    () => [
      {
        accessorKey: "business_name",
        header: "Merchant",
        cell: ({ row }) => (
          <div className="space-y-1">
            <button
              className="block text-left font-semibold text-[#0B0F15] hover:text-[#0E5EC9]"
              onClick={() => setSelectedId(row.original.id)}
            >
              {row.original.business_name}
              <span className="block text-xs font-normal text-[#25425E]/65">{row.original.industry}</span>
            </button>
            <Link className="text-xs font-semibold text-[#0E5EC9] hover:text-[#D57D25]" href={`/merchants/${row.original.id}`}>
              Open profile
            </Link>
            {canDeleteMerchants ? (
              <div className="pt-1">
                <DeleteMerchantButton
                  merchantId={row.original.id}
                  merchantName={row.original.business_name}
                  label="Delete"
                  compact
                  onDeleted={handleMerchantDeleted}
                />
              </div>
            ) : null}
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
    [agentsById, canDeleteMerchants, handleMerchantDeleted],
  );

  const table = useReactTable({
    data: filteredMerchants,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedMerchant = merchants.find((merchant) => merchant.id === selectedId) ?? merchants[0];
  const visibleMerchants = table.getFilteredRowModel().rows.map((row) => row.original);
  const visibleVolume = visibleMerchants.reduce((total, merchant) => total + Number(merchant.monthly_volume_estimate || 0), 0);
  const visibleApprovals = visibleMerchants.filter((merchant) => requiresManagementApproval(Number(merchant.proposed_rate || 0))).length;
  const visibleProcessing = visibleMerchants.filter((merchant) => merchant.status === "processing" || merchant.status === "onboarded").length;

  function updateField<TKey extends keyof FormState>(key: TKey, value: FormState[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setGlobalFilter("");
    setStageFilter("all");
    setAgentFilter("all");
  }

  function exportMerchantsCsv() {
    const rows = table.getFilteredRowModel().rows.map((row) => row.original);

    if (!rows.length) {
      setMessage("There are no merchants to export with the current filters.");
      return;
    }

    const headers = [
      "Business Name",
      "Contact",
      "Email",
      "Phone",
      "Industry",
      "Status",
      "Assigned Agent",
      "Monthly Volume",
      "Average Ticket",
      "Current Processor",
      "Proposed Rate",
      "Updated At",
    ];
    const lines = rows.map((merchant) =>
      [
        merchant.business_name,
        merchant.contact_name,
        merchant.contact_email,
        merchant.contact_phone,
        merchant.industry,
        titleCase(merchant.status),
        agentsById.get(merchant.assigned_agent_id) ?? "",
        merchant.monthly_volume_estimate,
        merchant.average_ticket,
        merchant.current_processor,
        merchant.proposed_rate,
        merchant.updated_at,
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[headers.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `merchantdesk-merchants-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${rows.length} merchant${rows.length === 1 ? "" : "s"} to CSV.`);
  }

  async function copyIntegrationGuide() {
    const origin = window.location.origin;
    const guide = [
      "MerchantDesk Integration API",
      "",
      "Add MERCHANTDESK_API_KEY in Vercel, then send it as:",
      "Authorization: Bearer $MERCHANTDESK_API_KEY",
      "",
      `GET ${origin}/api/merchants?limit=25`,
      `POST ${origin}/api/merchants`,
      `GET ${origin}/api/tasks?status=open&limit=25`,
      `POST ${origin}/api/tasks`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(guide);
      setMessage("MerchantDesk API quick-start copied.");
    } catch {
      setMessage("API quick-start: call /api/merchants and /api/tasks with Authorization: Bearer $MERCHANTDESK_API_KEY.");
    }
  }

  useEffect(() => {
    function handleGlobalSearch(event: Event) {
      const query = (event as CustomEvent<{ query?: string }>).detail?.query ?? "";
      setGlobalFilter(query);
    }

    window.addEventListener("crm:global-search", handleGlobalSearch);
    return () => window.removeEventListener("crm:global-search", handleGlobalSearch);
  }, []);

  function addMerchant() {
    if (!form.business_name.trim() || !form.contact_name.trim()) {
      setMessage("Business name and contact are required.");
      return;
    }

    if (!effectiveAssignedAgentId) {
      setMessage("Create or select an agent before adding merchants.");
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button variant="secondary" type="button" onClick={copyIntegrationGuide}>
                <PlugZap className="h-4 w-4" />
                API Ready
              </Button>
              <Button variant="secondary" type="button" onClick={exportMerchantsCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <label className="relative block w-full min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="merchant-filter"
                  className="pl-9"
                  value={globalFilter}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  placeholder="Filter merchant table"
                />
              </label>
              <Button
                variant="secondary"
                size="icon"
                type="button"
                aria-label="Table controls"
                aria-expanded={showControls}
                aria-controls="merchant-table-controls"
                onClick={() => setShowControls((current) => !current)}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showControls ? (
            <div
              id="merchant-table-controls"
              className="crm-panel mb-4 grid gap-3 rounded-[24px] p-3 md:grid-cols-[1fr_1fr_auto]"
            >
              <Field label="Stage filter">
                <Select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as MerchantStatus | "all")}>
                  <option value="all">All stages</option>
                  {pipelineStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Agent filter">
                <Select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)}>
                  <option value="all">All agents</option>
                  {agentOptions.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <Button className="w-full md:w-auto" variant="secondary" type="button" onClick={resetFilters} disabled={!hasActiveControls}>
                  Reset
                </Button>
              </div>
            </div>
          ) : null}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <MerchantSummary label="Visible accounts" value={visibleMerchants.length.toString()} detail={`${merchants.length} total in book`} />
            <MerchantSummary label="Filtered volume" value={currency(visibleVolume)} detail={`${visibleProcessing} onboarded or processing`} />
            <MerchantSummary label="Pricing alerts" value={visibleApprovals.toString()} detail="below management floor" />
          </div>
          {table.getRowModel().rows.length ? (
            <div className="overflow-hidden rounded-[24px] border border-[#ABB7C0]/25 bg-white/50">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-[#FDFDFD]/80 text-left text-xs uppercase text-[#25425E]/70">
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
                  <tbody className="divide-y divide-[#ABB7C0]/20">
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="bg-white/65 hover:bg-[#E9D7A1]/18">
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
              action={
                hasActiveControls ? (
                  <Button variant="secondary" type="button" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : null
              }
            />
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card id="add-merchant">
          <CardHeader>
            <CardTitle>Add Merchant</CardTitle>
            <CardDescription>Fast lead capture for agents in the field.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="Business name">
                <Input id="merchant-business-name" value={form.business_name} onChange={(event) => updateField("business_name", event.target.value)} placeholder="ABC Grocery" />
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
              <p className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">
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
              <div className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">
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
              {canDeleteMerchants ? (
                <div className="rounded-[24px] border border-[#D57D25]/25 bg-[#D57D25]/10 p-3">
                  <p className="text-sm font-semibold text-[#0B0F15]">Delete client</p>
                  <p className="mt-1 text-sm leading-6 text-[#25425E]/75">
                    Permanently remove this merchant and its related CRM records from the book.
                  </p>
                  <div className="mt-3">
                    <DeleteMerchantButton
                      merchantId={selectedMerchant.id}
                      merchantName={selectedMerchant.business_name}
                      onDeleted={handleMerchantDeleted}
                    />
                  </div>
                </div>
              ) : null}
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
    <div className="crm-panel flex items-center justify-between gap-3 rounded-2xl p-3">
      <span className="flex min-w-0 items-center gap-2 text-[#25425E]/70">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="min-w-0 truncate text-right font-semibold text-[#0B0F15]">{value}</span>
    </div>
  );
}

function MerchantSummary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-[#ABB7C0]/20 bg-white/55 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-[#25425E]/60">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#0B0F15]">{value}</p>
      <p className="text-xs font-medium text-[#25425E]/65">{detail}</p>
    </div>
  );
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

export function StatusBadge({ status }: { status: MerchantStatus }) {
  const tone = status === "processing" || status === "approved" ? "blue" : status === "underwriting" ? "amber" : status === "lost" ? "rose" : "slate";
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}
