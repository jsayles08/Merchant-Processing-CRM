"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, MessageSquarePlus, Plus, UserPlus, UsersRound } from "lucide-react";
import { addRecruitUpdateAction, createRecruitAction } from "@/lib/actions";
import type { AgentRecruit, AgentRecruitUpdate, CrmData, RecruitStatus } from "@/lib/types";
import { labelForStatus, recruitStatuses } from "@/lib/workflow-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Textarea } from "@/components/ui/field";

type RecruitForm = {
  full_name: string;
  email: string;
  phone: string;
  source: string;
  status: RecruitStatus;
  assigned_recruiter_id: string;
  follow_up_at: string;
  notes: string;
};

const blankRecruit: RecruitForm = {
  full_name: "",
  email: "",
  phone: "",
  source: "",
  status: "new_lead",
  assigned_recruiter_id: "",
  follow_up_at: "",
  notes: "",
};

export function RecruitmentWorkspace({ data }: { data: CrmData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [recruits, setRecruits] = useState(data.agentRecruits);
  const [updates, setUpdates] = useState(data.agentRecruitUpdates);
  const [selectedRecruitId, setSelectedRecruitId] = useState(data.agentRecruits[0]?.id ?? "");
  const [form, setForm] = useState<RecruitForm>(blankRecruit);
  const [timelineNote, setTimelineNote] = useState("");
  const [timelineStatus, setTimelineStatus] = useState<RecruitStatus>("contacted");
  const [timelineFollowUp, setTimelineFollowUp] = useState("");
  const recruiterOptions = data.profiles.filter((profile) => profile.status !== "inactive");
  const selectedRecruit = recruits.find((recruit) => recruit.id === selectedRecruitId) ?? recruits[0];

  const metrics = useMemo(() => {
    const total = recruits.length;
    const activePipeline = recruits.filter((recruit) => !["active", "rejected"].includes(recruit.status)).length;
    const active = recruits.filter((recruit) => recruit.status === "active").length;
    const pendingFollowUps = recruits.filter((recruit) => recruit.follow_up_at && new Date(recruit.follow_up_at) >= new Date()).length;
    return {
      total,
      activePipeline,
      conversionRate: total ? Math.round((active / total) * 100) : 0,
      pendingFollowUps,
    };
  }, [recruits]);

  function updateForm<TKey extends keyof RecruitForm>(key: TKey, value: RecruitForm[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addRecruit() {
    startTransition(async () => {
      const result = await createRecruitAction(form);
      setMessage(result.message);
      if (result.ok && result.data) {
        const recruit = result.data as AgentRecruit;
        setRecruits((current) => [recruit, ...current]);
        setSelectedRecruitId(recruit.id);
        setForm(blankRecruit);
        router.refresh();
      }
    });
  }

  function addTimelineUpdate() {
    if (!selectedRecruit || !timelineNote.trim()) {
      setMessage("Choose a recruit and add a timeline note.");
      return;
    }

    startTransition(async () => {
      const result = await addRecruitUpdateAction({
        recruit_id: selectedRecruit.id,
        status: timelineStatus,
        note: timelineNote,
        follow_up_at: timelineFollowUp,
      });
      setMessage(result.message);
      if (result.ok && result.data) {
        const savedUpdate = result.data as AgentRecruitUpdate;
        setUpdates((current) => [savedUpdate, ...current]);
        setRecruits((current) =>
          current.map((recruit) =>
            recruit.id === selectedRecruit.id
              ? {
                  ...recruit,
                  status: timelineStatus,
                  follow_up_at: timelineFollowUp ? new Date(timelineFollowUp).toISOString() : recruit.follow_up_at,
                  updated_at: new Date().toISOString(),
                }
              : recruit,
          ),
        );
        setTimelineNote("");
        setTimelineFollowUp("");
        router.refresh();
      }
    });
  }

  const selectedUpdates = selectedRecruit ? updates.filter((update) => update.recruit_id === selectedRecruit.id) : [];

  return (
    <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recruitment Dashboard</CardTitle>
            <CardDescription>Track potential agents from first contact through activation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Metric label="Total recruits" value={metrics.total} icon={<UsersRound className="h-4 w-4" />} />
            <Metric label="Active pipeline" value={metrics.activePipeline} icon={<UserPlus className="h-4 w-4" />} />
            <Metric label="Conversion rate" value={`${metrics.conversionRate}%`} icon={<CheckCircle2 className="h-4 w-4" />} />
            <Metric label="Pending follow-ups" value={metrics.pendingFollowUps} icon={<CalendarClock className="h-4 w-4" />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Recruit</CardTitle>
            <CardDescription>Create a recruiting lead with ownership and next steps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Full name">
              <Input value={form.full_name} onChange={(event) => updateForm("full_name", event.target.value)} placeholder="Taylor Morgan" />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="taylor@example.com" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="Phone">
                <Input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="(555) 010-0123" />
              </Field>
              <Field label="Source">
                <Input value={form.source} onChange={(event) => updateForm("source", event.target.value)} placeholder="Referral, LinkedIn, event" />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(event) => updateForm("status", event.target.value as RecruitStatus)}>
                  {recruitStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Assigned recruiter">
                <Select value={form.assigned_recruiter_id} onChange={(event) => updateForm("assigned_recruiter_id", event.target.value)}>
                  <option value="">Me / default</option>
                  {recruiterOptions.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Follow-up">
                <Input type="datetime-local" value={form.follow_up_at} onChange={(event) => updateForm("follow_up_at", event.target.value)} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Background, goals, objections, next step..." />
            </Field>
            {message ? <p className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">{message}</p> : null}
            <Button className="w-full" disabled={isPending} onClick={addRecruit}>
              <Plus className="h-4 w-4" />
              Add Recruit
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recruit Pipeline</CardTitle>
            <CardDescription>Filter visually by status and open a recruit to manage their timeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!recruits.length ? (
              <EmptyState icon={<UserPlus className="h-5 w-5" />} title="No recruits yet" description="Add your first potential agent to start building the pipeline." />
            ) : null}
            {recruits.map((recruit) => {
              const recruiter = data.profiles.find((profile) => profile.id === recruit.assigned_recruiter_id);
              const active = selectedRecruit?.id === recruit.id;
              return (
                <button
                  key={recruit.id}
                  className={`crm-panel grid w-full gap-3 rounded-[24px] p-4 text-left transition md:grid-cols-[1fr_auto] ${
                    active ? "border-[#0E5EC9]/35 bg-white/85 shadow-[0_16px_40px_rgba(14,94,201,0.12)]" : ""
                  }`}
                  onClick={() => setSelectedRecruitId(recruit.id)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[#0B0F15]">{recruit.full_name}</p>
                      <Badge tone={statusTone(recruit.status)}>{labelForStatus(recruit.status, recruitStatuses)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#25425E]/70">
                      {recruit.email || "No email"} · {recruit.source || "Unknown source"} · {recruiter?.full_name ?? "Unassigned"}
                    </p>
                    {recruit.notes ? <p className="mt-2 line-clamp-2 text-sm text-[#25425E]">{recruit.notes}</p> : null}
                  </div>
                  <span className="text-xs font-semibold text-[#25425E]/60">
                    {recruit.follow_up_at ? new Date(recruit.follow_up_at).toLocaleDateString() : "No follow-up"}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{selectedRecruit?.full_name ?? "Recruit Timeline"}</CardTitle>
                <CardDescription>Notes, status movement, and follow-up reminders.</CardDescription>
              </div>
              {selectedRecruit ? <Badge tone={statusTone(selectedRecruit.status)}>{labelForStatus(selectedRecruit.status, recruitStatuses)}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRecruit ? (
              <>
                <div className="grid gap-3 md:grid-cols-[0.6fr_1fr_auto]">
                  <Select value={timelineStatus} onChange={(event) => setTimelineStatus(event.target.value as RecruitStatus)}>
                    {recruitStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </Select>
                  <Input type="datetime-local" value={timelineFollowUp} onChange={(event) => setTimelineFollowUp(event.target.value)} />
                  <Button onClick={addTimelineUpdate} disabled={isPending}>
                    <MessageSquarePlus className="h-4 w-4" />
                    Save
                  </Button>
                </div>
                <Textarea value={timelineNote} onChange={(event) => setTimelineNote(event.target.value)} placeholder="Add a recruiting note or next step..." />
                <div className="space-y-3">
                  {selectedUpdates.map((update) => {
                    const author = data.profiles.find((profile) => profile.id === update.author_profile_id);
                    return (
                      <div key={update.id} className="crm-panel rounded-[22px] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold text-[#0B0F15]">{author?.full_name ?? "System"}</p>
                          <span className="text-xs font-semibold text-[#25425E]/60">{new Date(update.created_at).toLocaleString()}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#25425E]">{update.note}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {update.status ? <Badge tone={statusTone(update.status)}>{labelForStatus(update.status, recruitStatuses)}</Badge> : null}
                          {update.follow_up_at ? <Badge tone="amber">Follow-up {new Date(update.follow_up_at).toLocaleDateString()}</Badge> : null}
                        </div>
                      </div>
                    );
                  })}
                  {!selectedUpdates.length ? <p className="text-sm text-[#25425E]/65">No timeline activity yet.</p> : null}
                </div>
              </>
            ) : (
              <EmptyState icon={<UserPlus className="h-5 w-5" />} title="Select a recruit" description="Choose a recruit to add notes and track their progress." />
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

function statusTone(status: RecruitStatus) {
  if (status === "active") return "blue";
  if (status === "rejected") return "rose";
  if (status === "onboarding" || status === "application_started") return "amber";
  if (status === "interested") return "emerald";
  return "slate";
}
