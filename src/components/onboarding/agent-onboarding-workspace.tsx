"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CheckCircle2, ClipboardCheck, GraduationCap, Plus, UserRoundCheck } from "lucide-react";
import {
  createAgentOnboardingAction,
  updateAgentOnboardingStatusAction,
  updateAgentOnboardingStepAction,
} from "@/lib/actions";
import type { AgentOnboardingRecord, AgentOnboardingStatus, AgentOnboardingStep, CrmData } from "@/lib/types";
import { agentOnboardingStatuses, labelForStatus } from "@/lib/workflow-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/field";

type AgentOnboardingForm = {
  profile_id: string;
  recruit_id: string;
  full_name: string;
  email: string;
  phone: string;
  assigned_admin_id: string;
  status: AgentOnboardingStatus;
};

const blankForm: AgentOnboardingForm = {
  profile_id: "",
  recruit_id: "",
  full_name: "",
  email: "",
  phone: "",
  assigned_admin_id: "",
  status: "invited",
};

export function AgentOnboardingWorkspace({ data }: { data: CrmData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [records, setRecords] = useState(data.agentOnboardingRecords);
  const [steps, setSteps] = useState(data.agentOnboardingSteps);
  const [selectedId, setSelectedId] = useState(data.agentOnboardingRecords[0]?.id ?? "");
  const [form, setForm] = useState<AgentOnboardingForm>(blankForm);
  const selectedRecord = records.find((record) => record.id === selectedId) ?? records[0];
  const selectedSteps = selectedRecord
    ? steps.filter((step) => step.onboarding_id === selectedRecord.id).sort((a, b) => a.step_order - b.step_order)
    : [];

  const metrics = useMemo(() => {
    const total = records.length;
    const active = records.filter((record) => record.status === "active").length;
    const underReview = records.filter((record) => record.status === "under_review").length;
    const documentsPending = records.filter((record) => !record.documents_signed).length;
    const averageCompletion = total ? Math.round(records.reduce((sum, record) => sum + record.training_progress, 0) / total) : 0;
    return { total, active, underReview, documentsPending, averageCompletion };
  }, [records]);

  function update<TKey extends keyof AgentOnboardingForm>(key: TKey, value: AgentOnboardingForm[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectRecruit(recruitId: string) {
    const recruit = data.agentRecruits.find((item) => item.id === recruitId);
    setForm((current) => ({
      ...current,
      recruit_id: recruitId,
      full_name: recruit?.full_name ?? current.full_name,
      email: recruit?.email ?? current.email,
      phone: recruit?.phone ?? current.phone,
    }));
  }

  function createRecord() {
    startTransition(async () => {
      const result = await createAgentOnboardingAction(form);
      setMessage(result.message);
      if (result.ok && result.data) {
        const record = result.data as AgentOnboardingRecord;
        setRecords((current) => [record, ...current]);
        setSelectedId(record.id);
        setForm(blankForm);
        router.refresh();
      }
    });
  }

  function updateStatus(status: AgentOnboardingStatus, trainingProgress = selectedRecord?.training_progress ?? 0) {
    if (!selectedRecord) return;
    startTransition(async () => {
      const result = await updateAgentOnboardingStatusAction({
        onboarding_id: selectedRecord.id,
        status,
        training_progress: trainingProgress,
      });
      setMessage(result.message);
      if (result.ok && result.data) {
        setRecords((current) => current.map((record) => (record.id === selectedRecord.id ? (result.data as AgentOnboardingRecord) : record)));
        router.refresh();
      }
    });
  }

  function toggleStep(step: AgentOnboardingStep) {
    startTransition(async () => {
      const completed = !step.completed_at;
      const result = await updateAgentOnboardingStepAction({ step_id: step.id, completed });
      setMessage(result.message);
      if (result.ok) {
        const completedAt = completed ? new Date().toISOString() : null;
        setSteps((current) => current.map((item) => (item.id === step.id ? { ...item, completed_at: completedAt } : item)));
        const nextSteps = selectedSteps.map((item) => (item.id === step.id ? { ...item, completed_at: completedAt } : item));
        const progress = nextSteps.length ? Math.round((nextSteps.filter((item) => item.completed_at).length / nextSteps.length) * 100) : 0;
        setRecords((current) =>
          current.map((record) =>
            record.id === step.onboarding_id
              ? {
                  ...record,
                  training_progress: progress,
                  profile_complete: progress >= 20,
                  documents_signed: progress >= 50,
                  account_activated: progress >= 100,
                }
              : record,
          ),
        );
        router.refresh();
      }
    });
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent Onboarding</CardTitle>
            <CardDescription>Move new agents through profile, training, documents, approval, and activation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Metric label="Onboarding" value={metrics.total} icon={<GraduationCap className="h-4 w-4" />} />
            <Metric label="Average completion" value={`${metrics.averageCompletion}%`} icon={<ClipboardCheck className="h-4 w-4" />} />
            <Metric label="Under review" value={metrics.underReview} icon={<BadgeCheck className="h-4 w-4" />} />
            <Metric label="Active agents" value={metrics.active} icon={<UserRoundCheck className="h-4 w-4" />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start Onboarding</CardTitle>
            <CardDescription>Create the onboarding checklist for a new agent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Recruit">
              <Select value={form.recruit_id} onChange={(event) => selectRecruit(event.target.value)}>
                <option value="">No recruit linked</option>
                {data.agentRecruits.map((recruit) => (
                  <option key={recruit.id} value={recruit.id}>
                    {recruit.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Existing profile">
              <Select value={form.profile_id} onChange={(event) => update("profile_id", event.target.value)}>
                <option value="">No profile yet</option>
                {data.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Full name">
              <Input value={form.full_name} onChange={(event) => update("full_name", event.target.value)} placeholder="New agent name" />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="agent@example.com" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="Phone">
                <Input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
              </Field>
              <Field label="Admin reviewer">
                <Select value={form.assigned_admin_id} onChange={(event) => update("assigned_admin_id", event.target.value)}>
                  <option value="">Me / default</option>
                  {data.profiles
                    .filter((profile) => profile.role !== "agent")
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            {message ? <p className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">{message}</p> : null}
            <Button className="w-full" onClick={createRecord} disabled={isPending}>
              <Plus className="h-4 w-4" />
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Queue</CardTitle>
            <CardDescription>Open an agent to update their checklist and activation status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!records.length ? (
              <EmptyState icon={<GraduationCap className="h-5 w-5" />} title="No onboarding records yet" description="Start onboarding when a recruit is ready for activation." />
            ) : null}
            {records.map((record) => (
              <button
                key={record.id}
                className={`crm-panel grid w-full gap-3 rounded-[24px] p-4 text-left md:grid-cols-[1fr_auto] ${
                  selectedRecord?.id === record.id ? "border-[#0E5EC9]/35 bg-white/85 shadow-[0_16px_40px_rgba(14,94,201,0.12)]" : ""
                }`}
                onClick={() => setSelectedId(record.id)}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[#0B0F15]">{record.full_name}</p>
                    <Badge tone={agentStatusTone(record.status)}>{labelForStatus(record.status, agentOnboardingStatuses)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[#25425E]/70">{record.email} · {record.training_progress}% complete</p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/80 md:w-36">
                  <div className="h-full rounded-full bg-[#0E5EC9]" style={{ width: `${record.training_progress}%` }} />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{selectedRecord?.full_name ?? "Onboarding Checklist"}</CardTitle>
                <CardDescription>Training, agreement signing, review, and account activation.</CardDescription>
              </div>
              {selectedRecord ? <Badge tone={agentStatusTone(selectedRecord.status)}>{labelForStatus(selectedRecord.status, agentOnboardingStatuses)}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRecord ? (
              <>
                <div className="grid gap-3 md:grid-cols-[0.7fr_1fr_auto]">
                  <Select value={selectedRecord.status} onChange={(event) => updateStatus(event.target.value as AgentOnboardingStatus)}>
                    {agentOnboardingStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedRecord.training_progress}
                    onChange={(event) => updateStatus(selectedRecord.status, Number(event.target.value))}
                  />
                  <span className="flex h-10 items-center justify-center rounded-full bg-white/70 px-4 text-sm font-bold text-[#25425E]">
                    {selectedRecord.training_progress}%
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Flag active={selectedRecord.profile_complete} label="Profile complete" />
                  <Flag active={selectedRecord.documents_signed} label="Documents signed" />
                  <Flag active={Boolean(selectedRecord.admin_approved_at)} label="Admin approved" />
                  <Flag active={selectedRecord.account_activated} label="Account activated" />
                </div>

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
                          {step.completed_at ? `Completed ${new Date(step.completed_at).toLocaleDateString()}` : "Open step"}
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
              <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="Select onboarding" description="Open an agent record to manage training and activation." />
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

function Flag({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="crm-panel flex items-center gap-3 rounded-[20px] p-3">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-[#0E5EC9] text-white" : "bg-white text-[#25425E]"}`}>
        <CheckCircle2 className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold text-[#25425E]">{label}</span>
    </div>
  );
}

function agentStatusTone(status: AgentOnboardingStatus) {
  if (status === "active" || status === "approved") return "blue";
  if (status === "under_review" || status === "documents_pending") return "amber";
  if (status === "training") return "emerald";
  return "slate";
}
