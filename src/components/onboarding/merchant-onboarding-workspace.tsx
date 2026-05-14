"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, ClipboardList, CreditCard, FileCheck2, Plus, Store } from "lucide-react";
import {
  createMerchantOnboardingAction,
  updateMerchantOnboardingStatusAction,
  updateMerchantOnboardingStepAction,
} from "@/lib/actions";
import type { CrmData, MerchantOnboardingRecord, MerchantOnboardingStatus, MerchantOnboardingStep } from "@/lib/types";
import { labelForStatus, merchantOnboardingStatuses } from "@/lib/workflow-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { currency } from "@/lib/utils";

type MerchantOnboardingForm = {
  business_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  industry: string;
  processing_needs: string;
  monthly_volume_estimate: string;
  average_ticket: string;
  current_processor: string;
  proposed_rate: string;
  status: MerchantOnboardingStatus;
  assigned_agent_id: string;
  follow_up_at: string;
  notes: string;
};

const blankForm: MerchantOnboardingForm = {
  business_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  industry: "",
  processing_needs: "",
  monthly_volume_estimate: "",
  average_ticket: "",
  current_processor: "",
  proposed_rate: "1.65",
  status: "lead",
  assigned_agent_id: "",
  follow_up_at: "",
  notes: "",
};

export function MerchantOnboardingWorkspace({ data, currentAgentId }: { data: CrmData; currentAgentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [records, setRecords] = useState(data.merchantOnboardingRecords);
  const [steps, setSteps] = useState(data.merchantOnboardingSteps);
  const [selectedId, setSelectedId] = useState(data.merchantOnboardingRecords[0]?.id ?? "");
  const [form, setForm] = useState<MerchantOnboardingForm>({ ...blankForm, assigned_agent_id: currentAgentId });
  const [statusNote, setStatusNote] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const selectedRecord = records.find((record) => record.id === selectedId) ?? records[0];
  const selectedSteps = selectedRecord
    ? steps.filter((step) => step.onboarding_id === selectedRecord.id).sort((a, b) => a.step_order - b.step_order)
    : [];
  const agentOptions = data.agents.map((agent) => {
    const profile = data.profiles.find((item) => item.id === agent.profile_id);
    return { id: agent.id, label: profile?.full_name ?? agent.agent_code };
  });

  const metrics = useMemo(() => {
    const total = records.length;
    const activePipeline = records.filter((record) => !["active", "declined"].includes(record.status)).length;
    const docsNeeded = records.filter((record) => record.status === "documents_needed").length;
    const active = records.filter((record) => record.status === "active").length;
    const volume = records.reduce((sum, record) => sum + Number(record.monthly_volume_estimate || 0), 0);
    return { total, activePipeline, docsNeeded, active, volume };
  }, [records]);

  function update<TKey extends keyof MerchantOnboardingForm>(key: TKey, value: MerchantOnboardingForm[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function createRecord() {
    startTransition(async () => {
      const result = await createMerchantOnboardingAction({
        ...form,
        monthly_volume_estimate: Number(form.monthly_volume_estimate) || 0,
        average_ticket: Number(form.average_ticket) || 0,
        proposed_rate: Number(form.proposed_rate) || 0,
      });
      setMessage(result.message);
      if (result.ok && result.data) {
        const record = result.data as MerchantOnboardingRecord;
        setRecords((current) => [record, ...current]);
        setSelectedId(record.id);
        setForm({ ...blankForm, assigned_agent_id: currentAgentId });
        router.refresh();
      }
    });
  }

  function updateStatus(status: MerchantOnboardingStatus) {
    if (!selectedRecord) return;
    startTransition(async () => {
      const result = await updateMerchantOnboardingStatusAction({
        onboarding_id: selectedRecord.id,
        status,
        follow_up_at: followUpAt,
        note: statusNote,
      });
      setMessage(result.message);
      if (result.ok && result.data) {
        setRecords((current) => current.map((record) => (record.id === selectedRecord.id ? (result.data as MerchantOnboardingRecord) : record)));
        setStatusNote("");
        setFollowUpAt("");
        router.refresh();
      }
    });
  }

  function toggleStep(step: MerchantOnboardingStep) {
    startTransition(async () => {
      const completed = !step.completed_at;
      const result = await updateMerchantOnboardingStepAction({ step_id: step.id, completed });
      setMessage(result.message);
      if (result.ok) {
        setSteps((current) =>
          current.map((item) => (item.id === step.id ? { ...item, completed_at: completed ? new Date().toISOString() : null } : item)),
        );
        router.refresh();
      }
    });
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Merchant Onboarding</CardTitle>
            <CardDescription>Capture new merchant applications, documents, and processor readiness.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Metric label="Applications" value={metrics.total} icon={<Store className="h-4 w-4" />} />
            <Metric label="Active pipeline" value={metrics.activePipeline} icon={<ClipboardList className="h-4 w-4" />} />
            <Metric label="Documents needed" value={metrics.docsNeeded} icon={<FileCheck2 className="h-4 w-4" />} />
            <Metric label="Pipeline volume" value={currency(metrics.volume)} icon={<CreditCard className="h-4 w-4" />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add New Merchant</CardTitle>
            <CardDescription>Create the merchant record, opportunity, and onboarding checklist together.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Business name">
              <Input value={form.business_name} onChange={(event) => update("business_name", event.target.value)} placeholder="Main Street Bistro" />
            </Field>
            <Field label="Contact name">
              <Input value={form.contact_name} onChange={(event) => update("contact_name", event.target.value)} placeholder="Alex Rivera" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Email">
                <Input value={form.contact_email} onChange={(event) => update("contact_email", event.target.value)} placeholder="owner@example.com" />
              </Field>
              <Field label="Phone">
                <Input value={form.contact_phone} onChange={(event) => update("contact_phone", event.target.value)} />
              </Field>
              <Field label="Industry">
                <Input value={form.industry} onChange={(event) => update("industry", event.target.value)} placeholder="Restaurant" />
              </Field>
              <Field label="Current processor">
                <Input value={form.current_processor} onChange={(event) => update("current_processor", event.target.value)} placeholder="Fiserv, TSYS, Square" />
              </Field>
              <Field label="Monthly volume">
                <Input value={form.monthly_volume_estimate} onChange={(event) => update("monthly_volume_estimate", event.target.value)} placeholder="65000" />
              </Field>
              <Field label="Average ticket">
                <Input value={form.average_ticket} onChange={(event) => update("average_ticket", event.target.value)} placeholder="42" />
              </Field>
              <Field label="Proposed rate">
                <Input value={form.proposed_rate} onChange={(event) => update("proposed_rate", event.target.value)} placeholder="1.65" />
              </Field>
              <Field label="Assigned agent">
                <Select value={form.assigned_agent_id} onChange={(event) => update("assigned_agent_id", event.target.value)}>
                  <option value="">Default agent</option>
                  {agentOptions.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(event) => update("status", event.target.value as MerchantOnboardingStatus)}>
                  {merchantOnboardingStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Follow-up">
                <Input type="datetime-local" value={form.follow_up_at} onChange={(event) => update("follow_up_at", event.target.value)} />
              </Field>
            </div>
            <Field label="Processing needs">
              <Textarea value={form.processing_needs} onChange={(event) => update("processing_needs", event.target.value)} placeholder="POS, e-commerce, cash discount, next-day funding..." />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Application context, objections, pricing notes..." />
            </Field>
            {message ? <p className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">{message}</p> : null}
            <Button className="w-full" onClick={createRecord} disabled={isPending}>
              <Plus className="h-4 w-4" />
              Add Merchant
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Application Pipeline</CardTitle>
            <CardDescription>Track merchant applications from lead to active processing account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!records.length ? (
              <EmptyState icon={<Building2 className="h-5 w-5" />} title="No merchant onboarding yet" description="Create a merchant application to start the onboarding workflow." />
            ) : null}
            {records.map((record) => {
              const agent = agentOptions.find((item) => item.id === record.assigned_agent_id);
              return (
                <button
                  key={record.id}
                  className={`crm-panel grid w-full gap-3 rounded-[24px] p-4 text-left md:grid-cols-[1fr_auto] ${
                    selectedRecord?.id === record.id ? "border-[#0E5EC9]/35 bg-white/85 shadow-[0_16px_40px_rgba(14,94,201,0.12)]" : ""
                  }`}
                  onClick={() => setSelectedId(record.id)}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[#0B0F15]">{record.business_name}</p>
                      <Badge tone={merchantStatusTone(record.status)}>{labelForStatus(record.status, merchantOnboardingStatuses)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#25425E]/70">
                      {record.contact_name} · {agent?.label ?? "Unassigned"} · {currency(record.monthly_volume_estimate)}
                    </p>
                    {record.processing_needs ? <p className="mt-2 line-clamp-2 text-sm text-[#25425E]">{record.processing_needs}</p> : null}
                  </div>
                  <span className="text-xs font-semibold text-[#25425E]/60">
                    {record.follow_up_at ? new Date(record.follow_up_at).toLocaleDateString() : "No follow-up"}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{selectedRecord?.business_name ?? "Merchant Checklist"}</CardTitle>
                <CardDescription>Documents, underwriting, approval, and activation tasks.</CardDescription>
              </div>
              {selectedRecord ? <Badge tone={merchantStatusTone(selectedRecord.status)}>{labelForStatus(selectedRecord.status, merchantOnboardingStatuses)}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRecord ? (
              <>
                <div className="grid gap-3 md:grid-cols-[0.7fr_1fr_auto]">
                  <Select value={selectedRecord.status} onChange={(event) => updateStatus(event.target.value as MerchantOnboardingStatus)}>
                    {merchantOnboardingStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </Select>
                  <Input type="datetime-local" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} />
                  <Button disabled={isPending} onClick={() => updateStatus(selectedRecord.status)}>
                    Save
                  </Button>
                </div>
                <Textarea value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder="Add a follow-up note for this status change..." />
                <div className="space-y-3">
                  {selectedSteps.map((step) => (
                    <button
                      key={step.id}
                      className="crm-panel flex w-full items-center justify-between gap-3 rounded-[22px] p-4 text-left"
                      onClick={() => toggleStep(step)}
                      disabled={isPending}
                    >
                      <span>
                        <span className="block font-semibold text-[#0B0F15]">{step.title}</span>
                        <span className="text-sm text-[#25425E]/65">
                          {step.completed_at ? `Completed ${new Date(step.completed_at).toLocaleDateString()}` : "Open requirement"}
                        </span>
                      </span>
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${step.completed_at ? "bg-[#0E5EC9] text-white" : "bg-white text-[#25425E]"}`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    </button>
                  ))}
                  {!selectedSteps.length ? <p className="text-sm text-[#25425E]/65">Checklist steps will appear after the record is saved and refreshed.</p> : null}
                </div>
              </>
            ) : (
              <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Select an application" description="Open a merchant to manage required documents and status." />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="crm-panel flex items-center justify-between rounded-[22px] p-4">
      <div>
        <p className="text-sm font-semibold text-[#25425E]/70">{label}</p>
        <p className="mt-1 text-2xl font-black text-[#0B0F15]">{value}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0E5EC9] shadow-inner ring-1 ring-[#ABB7C0]/25">
        {icon}
      </span>
    </div>
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

function merchantStatusTone(status: MerchantOnboardingStatus) {
  if (status === "active" || status === "approved") return "blue";
  if (status === "declined") return "rose";
  if (status === "documents_needed" || status === "under_review") return "amber";
  if (status === "application_started") return "emerald";
  return "slate";
}
