"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  BriefcaseBusiness,
  CheckCircle2,
  KeyRound,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { createAgentProfileAction, deleteAgentProfileAction, updateAgentProfileAction } from "@/lib/actions";
import { buildAgentDirectory, buildSuggestedAgentCode, type AgentDirectoryRow } from "@/lib/agent-management";
import type { CrmData, Profile } from "@/lib/types";

type AgentForm = {
  profile_id: string;
  agent_id: string;
  full_name: string;
  email: string;
  phone: string;
  status: "active" | "invited" | "inactive";
  manager_id: string;
  agent_code: string;
  sponsor_agent_id: string;
  agent_status: "active" | "ramping" | "inactive";
  start_date: string;
  temp_password: string;
};

const emptyForm: AgentForm = {
  profile_id: "",
  agent_id: "",
  full_name: "",
  email: "",
  phone: "",
  status: "active",
  manager_id: "",
  agent_code: "",
  sponsor_agent_id: "",
  agent_status: "active",
  start_date: new Date().toISOString().slice(0, 10),
  temp_password: "",
};

export function AgentsWorkspace({
  data,
  currentProfile,
  canManageAgents,
}: {
  data: CrmData;
  currentProfile: Profile;
  canManageAgents: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<AgentForm>(emptyForm);
  const rows = useMemo(() => buildAgentDirectory(data), [data]);
  const managers = data.profiles.filter((profile) => profile.role === "manager" || profile.role === "admin");
  const sponsorOptions = rows.filter((row) => row.agent && row.agent.id !== form.agent_id);
  const activeCount = rows.filter((row) => row.profile.status === "active" && row.agent?.status !== "inactive").length;
  const rampingCount = rows.filter((row) => row.agent?.status === "ramping").length;
  const merchantCount = rows.reduce((total, row) => total + row.merchantCount, 0);

  function update<TKey extends keyof AgentForm>(key: TKey, value: AgentForm[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setMode("create");
    setForm(emptyForm);
  }

  function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const symbols = "!@$%";
    const password = Array.from({ length: 14 }, () => alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length]).join("");
    update("temp_password", `${password}${symbols[crypto.getRandomValues(new Uint32Array(1))[0] % symbols.length]}8`);
    setMessage("Temporary password generated. Share it through a secure channel.");
  }

  function suggestAgentCode() {
    update("agent_code", buildSuggestedAgentCode(form.full_name || "Agent", data.agents.map((agent) => agent.agent_code)));
  }

  function editAgent(row: AgentDirectoryRow) {
    if (!row.agent) return;
    setMode("edit");
    setMessage("");
    setForm({
      profile_id: row.profile.id,
      agent_id: row.agent.id,
      full_name: row.profile.full_name,
      email: row.profile.email,
      phone: row.profile.phone ?? "",
      status: row.profile.status,
      manager_id: row.profile.manager_id ?? "",
      agent_code: row.agent.agent_code,
      sponsor_agent_id: row.agent.sponsor_agent_id ?? "",
      agent_status: row.agent.status,
      start_date: row.agent.start_date,
      temp_password: "",
    });
  }

  function saveAgent() {
    if (!canManageAgents) {
      setMessage("You can view agents, but you do not have permission to manage them.");
      return;
    }
    if (!form.full_name.trim() || !form.email.trim()) {
      setMessage("Add the agent name and email.");
      return;
    }
    if (mode === "create" && form.temp_password.length < 8) {
      setMessage("Add or generate a temporary password with at least 8 characters.");
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createAgentProfileAction({
              full_name: form.full_name,
              email: form.email,
              phone: form.phone,
              status: form.status,
              manager_id: form.manager_id || undefined,
              agent_code: form.agent_code,
              sponsor_agent_id: form.sponsor_agent_id || undefined,
              temp_password: form.temp_password,
            })
          : await updateAgentProfileAction({
              profile_id: form.profile_id,
              agent_id: form.agent_id,
              full_name: form.full_name,
              email: form.email,
              phone: form.phone,
              status: form.status,
              manager_id: form.manager_id || null,
              agent_code: form.agent_code,
              sponsor_agent_id: form.sponsor_agent_id || null,
              agent_status: form.agent_status,
              start_date: form.start_date,
            });

      setMessage(result.message);
      if (result.ok) {
        resetForm();
        router.refresh();
      }
    });
  }

  function deleteAgent(row: AgentDirectoryRow) {
    if (!canManageAgents) {
      setMessage("You can view agents, but you do not have permission to delete them.");
      return;
    }
    const label = row.canHardDelete ? "delete this agent profile" : "deactivate this agent because CRM history exists";
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;

    startTransition(async () => {
      const result = await deleteAgentProfileAction({ profile_id: row.profile.id });
      setMessage(result.message);
      if (result.ok) {
        resetForm();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <AgentStat label="Active agents" value={activeCount.toString()} icon={<UsersRound className="h-5 w-5" />} />
        <AgentStat label="Ramping agents" value={rampingCount.toString()} icon={<Sparkles className="h-5 w-5" />} />
        <AgentStat label="Assigned merchants" value={merchantCount.toString()} icon={<BriefcaseBusiness className="h-5 w-5" />} />
      </section>

      {message ? (
        <div className="crm-panel rounded-[24px] border-[#0E5EC9]/20 bg-[#0E5EC9]/10 p-4 text-sm font-semibold text-[#25425E]">
          {message}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{mode === "create" ? "Add Agent" : "Edit Agent"}</CardTitle>
                <CardDescription>
                  {mode === "create"
                    ? "Create a CRM login, profile, agent record, manager assignment, and sponsor relationship."
                    : "Update the agent profile, directory details, status, and team sponsor."}
                </CardDescription>
              </div>
              <Badge tone={canManageAgents ? "emerald" : "slate"}>{canManageAgents ? "Manage enabled" : "View only"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset disabled={!canManageAgents || isPending} className="space-y-4 disabled:opacity-60">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Full name">
                  <Input value={form.full_name} onChange={(event) => update("full_name", event.target.value)} placeholder="Jane Doe" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="jane@company.com" />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(555) 555-0123" />
                </Field>
                <Field label="Profile status">
                  <Select value={form.status} onChange={(event) => update("status", event.target.value as AgentForm["status"])}>
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </Field>
                <Field label="Manager">
                  <Select value={form.manager_id} onChange={(event) => update("manager_id", event.target.value)}>
                    <option value="">No manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.full_name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Sponsor agent">
                  <Select value={form.sponsor_agent_id} onChange={(event) => update("sponsor_agent_id", event.target.value)}>
                    <option value="">No sponsor</option>
                    {sponsorOptions.map((row) => (
                      <option key={row.agent?.id} value={row.agent?.id}>
                        {row.profile.full_name} · {row.agent?.agent_code}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Agent code">
                  <div className="flex gap-2">
                    <Input value={form.agent_code} onChange={(event) => update("agent_code", event.target.value)} placeholder="Auto-generated if blank" />
                    <Button type="button" variant="secondary" onClick={suggestAgentCode}>
                      <KeyRound className="h-4 w-4" />
                      Suggest
                    </Button>
                  </div>
                </Field>
                {mode === "edit" ? (
                  <>
                    <Field label="Agent status">
                      <Select value={form.agent_status} onChange={(event) => update("agent_status", event.target.value as AgentForm["agent_status"])}>
                        <option value="active">Active</option>
                        <option value="ramping">Ramping</option>
                        <option value="inactive">Inactive</option>
                      </Select>
                    </Field>
                    <Field label="Start date">
                      <Input type="date" value={form.start_date} onChange={(event) => update("start_date", event.target.value)} />
                    </Field>
                  </>
                ) : (
                  <Field label="Temporary password">
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={form.temp_password}
                        onChange={(event) => update("temp_password", event.target.value)}
                        placeholder="Minimum 8 characters"
                      />
                      <Button type="button" variant="secondary" onClick={generatePassword}>
                        <Sparkles className="h-4 w-4" />
                        Generate
                      </Button>
                    </div>
                  </Field>
                )}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveAgent} disabled={!canManageAgents || isPending}>
                {mode === "create" ? <UserPlus className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {mode === "create" ? "Add Agent" : "Save Changes"}
              </Button>
              {mode === "edit" ? (
                <Button type="button" variant="secondary" onClick={resetForm} disabled={isPending}>
                  <ArrowRightLeft className="h-4 w-4" />
                  Cancel Edit
                </Button>
              ) : null}
            </div>
            {!canManageAgents ? (
              <p className="rounded-[20px] bg-white/60 p-3 text-sm leading-6 text-[#25425E]/75">
                Ask an admin to enable <strong>Manage agents</strong> in Settings if you need add, edit, or delete controls.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Agent Directory</CardTitle>
                <CardDescription>Agent profiles, managers, sponsors, status, and CRM ownership in one place.</CardDescription>
              </div>
              <Badge tone="blue">{rows.length} profiles</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.map((row) => (
              <article key={row.profile.id} className="crm-panel grid gap-4 rounded-[26px] p-4 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B0F15] text-white">
                      <UserCog className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-black text-[#0B0F15]">{row.profile.full_name}</h2>
                      <p className="text-sm text-[#25425E]/70">{row.profile.email}</p>
                    </div>
                    <Badge tone={row.profile.status === "active" ? "emerald" : row.profile.status === "inactive" ? "rose" : "amber"}>
                      {row.profile.status}
                    </Badge>
                    <Badge tone={row.agent?.status === "active" ? "blue" : row.agent?.status === "inactive" ? "rose" : "amber"}>
                      {row.agent?.status ?? "No agent record"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-[#25425E]/75 sm:grid-cols-2 xl:grid-cols-4">
                    <DirectoryMetric label="Agent code" value={row.agent?.agent_code ?? "Missing"} />
                    <DirectoryMetric label="Manager" value={row.manager?.full_name ?? "No manager"} />
                    <DirectoryMetric label="Sponsor" value={row.sponsorProfile?.full_name ?? "No sponsor"} />
                    <DirectoryMetric label="Start date" value={row.agent?.start_date ?? "Not set"} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{row.merchantCount} merchants</Badge>
                    <Badge>{row.dealCount} deals</Badge>
                    <Badge>{row.taskCount} tasks</Badge>
                    <Badge>{row.sponsoredAgentCount} sponsored</Badge>
                    <Badge tone={row.canHardDelete ? "emerald" : "amber"}>
                      {row.canHardDelete ? "Delete-safe" : "History protected"}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                  <Button type="button" variant="secondary" onClick={() => editAgent(row)} disabled={!canManageAgents || !row.agent || isPending}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button type="button" variant="danger" onClick={() => deleteAgent(row)} disabled={!canManageAgents || isPending}>
                    <Trash2 className="h-4 w-4" />
                    {row.canHardDelete ? "Delete" : "Deactivate"}
                  </Button>
                </div>
              </article>
            ))}
            {!rows.length ? (
              <div className="crm-panel rounded-[26px] p-6 text-center text-sm text-[#25425E]/70">
                No agent profiles yet. Add the first agent to start building the team directory.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Permission Reminder</CardTitle>
          <CardDescription>
            Agent access is controlled in Settings. You are signed in as {currentProfile.full_name} with the {currentProfile.role} role.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <PermissionNote icon={<UsersRound className="h-4 w-4" />} label="Agents" description="Controls visibility of this directory and nav section." />
          <PermissionNote icon={<ShieldCheck className="h-4 w-4" />} label="Manage agents" description="Controls add, edit, delete, and deactivate operations." />
          <PermissionNote icon={<KeyRound className="h-4 w-4" />} label="Settings" description="Admins tune these permissions in Enterprise Access Control." />
        </CardContent>
      </Card>
    </div>
  );
}

function AgentStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#25425E]/70">{label}</p>
          <p className="mt-2 text-4xl font-black text-[#0B0F15]">{value}</p>
        </div>
        <span className="grid h-14 w-14 place-items-center rounded-[22px] bg-[#0B0F15] text-white">{icon}</span>
      </CardContent>
    </Card>
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

function DirectoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-[#25425E]/55">{label}</p>
      <p className="mt-1 truncate font-semibold text-[#0B0F15]">{value}</p>
    </div>
  );
}

function PermissionNote({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  return (
    <div className="crm-panel rounded-[24px] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#0E5EC9] shadow-sm">{icon}</span>
        <p className="font-black text-[#0B0F15]">{label}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#25425E]/70">{description}</p>
    </div>
  );
}
