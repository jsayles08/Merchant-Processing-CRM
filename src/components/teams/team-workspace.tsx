"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Gauge, ListChecks, Plus, UserRoundCheck, UsersRound } from "lucide-react";
import { assignRecruitToTeamAction, updateRecruitProgressAction } from "@/lib/actions";
import { buildTeamMetrics, getTeamCapacity, progressForRecruitStatus } from "@/lib/team-management";
import type { CrmData, RecruitStatus, Team } from "@/lib/types";
import { currency } from "@/lib/utils";
import { labelForStatus, recruitStatuses } from "@/lib/workflow-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Textarea } from "@/components/ui/field";

type ProgressDraft = {
  recruitId: string;
  status: RecruitStatus;
  progress: number;
  note: string;
};

export function TeamWorkspace({ data }: { data: CrmData; currentProfileId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const firstTeamId = data.teams[0]?.id ?? "";
  const [selectedTeamId, setSelectedTeamId] = useState(firstTeamId);
  const [selectedRecruitId, setSelectedRecruitId] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [progressDraft, setProgressDraft] = useState<ProgressDraft>({
    recruitId: "",
    status: "contacted",
    progress: 25,
    note: "",
  });
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) ?? data.teams[0];
  const limit = Number(data.enterpriseSettings.find((setting) => setting.setting_key === "team_recruit_limit")?.setting_value?.limit ?? 4);
  const teams = useMemo(() => data.teams.map((team) => hydrateTeam(data, team, limit)), [data, limit]);
  const selected = selectedTeam ? hydrateTeam(data, selectedTeam, limit) : null;
  const availableRecruits = data.agentRecruits.filter(
    (recruit) => !["active", "rejected"].includes(recruit.status) && recruit.assigned_recruiter_id !== selected?.leaderProfile?.id,
  );
  const activeTeamPayroll = selected
    ? data.residuals
        .filter((residual) => selected.agentIds.has(residual.agent_id))
        .reduce((sum, residual) => sum + residual.agent_residual_amount, 0)
    : 0;

  function assignRecruit() {
    if (!selectedTeam || !selectedRecruitId) {
      setMessage("Choose a team and recruit before assigning.");
      return;
    }

    startTransition(async () => {
      const result = await assignRecruitToTeamAction({
        team_id: selectedTeam.id,
        recruit_id: selectedRecruitId,
        note: assignNote,
      });
      setMessage(result.message);
      if (result.ok) {
        setSelectedRecruitId("");
        setAssignNote("");
        router.refresh();
      }
    });
  }

  function updateProgress() {
    if (!progressDraft.recruitId) {
      setMessage("Choose a recruit before updating progress.");
      return;
    }

    startTransition(async () => {
      const result = await updateRecruitProgressAction({
        recruit_id: progressDraft.recruitId,
        team_id: selectedTeam?.id ?? null,
        status: progressDraft.status,
        progress_percent: progressDraft.progress,
        note: progressDraft.note,
      });
      setMessage(result.message);
      if (result.ok) {
        setProgressDraft((current) => ({ ...current, note: "" }));
        router.refresh();
      }
    });
  }

  function chooseProgressRecruit(recruitId: string) {
    const recruit = data.agentRecruits.find((item) => item.id === recruitId);
    const status = recruit?.status ?? "contacted";
    setProgressDraft({
      recruitId,
      status,
      progress: progressForRecruitStatus(status),
      note: "",
    });
  }

  return (
    <section id="teams" className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Management</CardTitle>
            <CardDescription>Manage team rosters, recruit capacity, and progress through activation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {teams.map((team) => (
              <button
                key={team.team.id}
                type="button"
                onClick={() => setSelectedTeamId(team.team.id)}
                className={`crm-panel rounded-[24px] p-4 text-left transition hover:-translate-y-0.5 ${
                  selectedTeam?.id === team.team.id ? "border-[#0E5EC9]/35 bg-white/85 shadow-[0_16px_40px_rgba(14,94,201,0.12)]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-[#0B0F15]">Team {team.team.team_number}</p>
                    <p className="mt-1 text-sm text-[#25425E]/70">{team.leaderProfile?.full_name ?? "Unassigned leader"}</p>
                  </div>
                  <Badge tone={team.capacity.isFull ? "amber" : "blue"}>
                    {team.capacity.used}/{team.capacity.limit}
                  </Badge>
                </div>
                <div className="mt-4 h-2 rounded-full bg-[#ABB7C0]/20">
                  <div className="h-2 rounded-full bg-[#0E5EC9]" style={{ width: `${Math.min(100, (team.capacity.used / team.capacity.limit) * 100)}%` }} />
                </div>
              </button>
            ))}
            {!teams.length ? (
              <EmptyState
                icon={<UsersRound className="h-5 w-5" />}
                title="No teams yet"
                description="Create agents with a sponsor in Settings to automatically build team rosters."
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assign Recruit</CardTitle>
            <CardDescription>Each team can carry up to four active recruits or active team members.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Recruit">
              <Select value={selectedRecruitId} onChange={(event) => setSelectedRecruitId(event.target.value)}>
                <option value="">Choose recruit</option>
                {availableRecruits.map((recruit) => (
                  <option key={recruit.id} value={recruit.id}>
                    {recruit.full_name} · {labelForStatus(recruit.status, recruitStatuses)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assignment note">
              <Textarea value={assignNote} onChange={(event) => setAssignNote(event.target.value)} placeholder="Why this recruit belongs on the team..." />
            </Field>
            <Button className="w-full" onClick={assignRecruit} disabled={isPending || !selectedTeam || !selectedRecruitId}>
              <Plus className="h-4 w-4" />
              Assign to Team
            </Button>
            {message ? <p className="crm-panel rounded-2xl p-3 text-sm font-semibold text-[#25425E]">{message}</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{selected ? `Team ${selected.team.team_number}` : "Team Detail"}</CardTitle>
                <CardDescription>Roster, recruit movement, and recent progress events.</CardDescription>
              </div>
              {selected ? (
                <Badge tone={selected.capacity.isFull ? "amber" : "blue"}>
                  {selected.capacity.available} slots open
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {selected ? (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <Metric icon={<UsersRound className="h-4 w-4" />} label="Roster" value={selected.capacity.activeMembers.length} />
                  <Metric icon={<Gauge className="h-4 w-4" />} label="Pipeline" value={selected.capacity.pipelineRecruits.length} />
                  <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Conversion" value={`${selected.metrics.conversionRate}%`} />
                  <Metric icon={<UserRoundCheck className="h-4 w-4" />} label="Payroll basis" value={currency(activeTeamPayroll)} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="crm-panel rounded-[24px] p-4">
                    <p className="text-sm font-black uppercase text-[#25425E]/70">Roster</p>
                    <div className="mt-3 space-y-2">
                      {selected.members.map((member) => (
                        <div key={member.member.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 p-3 text-sm">
                          <div>
                            <p className="font-semibold text-[#0B0F15]">{member.profile?.full_name ?? member.agent?.agent_code}</p>
                            <p className="text-[#25425E]/65">{member.agent?.agent_code ?? "Agent record"}</p>
                          </div>
                          <Badge tone={member.member.active_recruit_status ? "blue" : "slate"}>
                            {member.member.active_recruit_status ? "Active recruit" : "Roster"}
                          </Badge>
                        </div>
                      ))}
                      {!selected.members.length ? <p className="text-sm text-[#25425E]/65">No active roster members yet.</p> : null}
                    </div>
                  </div>

                  <div className="crm-panel rounded-[24px] p-4">
                    <p className="text-sm font-black uppercase text-[#25425E]/70">Recruit Pipeline</p>
                    <div className="mt-3 space-y-2">
                      {selected.capacity.pipelineRecruits.map((recruit) => {
                        const latest = data.recruitProgress
                          .filter((progress) => progress.recruit_id === recruit.id)
                          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                        const progress = latest?.progress_percent ?? progressForRecruitStatus(recruit.status);
                        return (
                          <button
                            key={recruit.id}
                            type="button"
                            onClick={() => chooseProgressRecruit(recruit.id)}
                            className="w-full rounded-2xl bg-white/60 p-3 text-left text-sm transition hover:bg-white"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-[#0B0F15]">{recruit.full_name}</p>
                              <Badge tone={statusTone(recruit.status)}>{labelForStatus(recruit.status, recruitStatuses)}</Badge>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-[#ABB7C0]/20">
                              <div className="h-2 rounded-full bg-[#0E5EC9]" style={{ width: `${progress}%` }} />
                            </div>
                          </button>
                        );
                      })}
                      {!selected.capacity.pipelineRecruits.length ? <p className="text-sm text-[#25425E]/65">No recruits are assigned to this team.</p> : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState icon={<UsersRound className="h-5 w-5" />} title="Choose a team" description="Team performance and roster details will appear here." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recruit Progress</CardTitle>
            <CardDescription>Update status, progress percent, and notes without leaving the team workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_0.65fr_0.45fr]">
              <Field label="Recruit">
                <Select value={progressDraft.recruitId} onChange={(event) => chooseProgressRecruit(event.target.value)}>
                  <option value="">Choose recruit</option>
                  {(selected?.capacity.pipelineRecruits ?? data.agentRecruits).map((recruit) => (
                    <option key={recruit.id} value={recruit.id}>
                      {recruit.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={progressDraft.status}
                  onChange={(event) => {
                    const status = event.target.value as RecruitStatus;
                    setProgressDraft((current) => ({ ...current, status, progress: progressForRecruitStatus(status) }));
                  }}
                >
                  {recruitStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Progress">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={progressDraft.progress}
                  onChange={(event) => setProgressDraft((current) => ({ ...current, progress: Number(event.target.value) || 0 }))}
                />
              </Field>
            </div>
            <Field label="Note">
              <Textarea
                value={progressDraft.note}
                onChange={(event) => setProgressDraft((current) => ({ ...current, note: event.target.value }))}
                placeholder="Training completed, documents requested, waiting on application..."
              />
            </Field>
            <Button onClick={updateProgress} disabled={isPending || !progressDraft.recruitId}>
              <ListChecks className="h-4 w-4" />
              Update Progress
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function hydrateTeam(data: CrmData, team: Team, limit: number) {
  const leader = data.agents.find((agent) => agent.id === team.leader_agent_id);
  const leaderProfile = data.profiles.find((profile) => profile.id === leader?.profile_id);
  const members = data.teamMembers
    .filter((member) => member.team_id === team.id)
    .map((member) => {
      const agent = data.agents.find((item) => item.id === member.agent_id);
      const profile = data.profiles.find((item) => item.id === agent?.profile_id);
      return { member, agent, profile };
    });
  const capacity = getTeamCapacity(data, team, limit);
  const metrics = buildTeamMetrics(data, team);
  const agentIds = new Set([team.leader_agent_id, ...members.map((member) => member.member.agent_id)]);
  return { team, leader, leaderProfile, members, capacity, metrics, agentIds };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="crm-panel rounded-2xl p-3">
      <p className="flex items-center gap-2 text-xs font-black uppercase text-[#25425E]/60">{icon}{label}</p>
      <p className="mt-2 text-xl font-black text-[#0B0F15]">{value}</p>
    </div>
  );
}

function statusTone(status: RecruitStatus) {
  if (status === "active") return "blue";
  if (status === "rejected") return "rose";
  if (status === "onboarding" || status === "application_started") return "amber";
  return "slate";
}
