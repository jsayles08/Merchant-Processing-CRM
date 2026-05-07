"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, KeyRound, UserPlus, UsersRound } from "lucide-react";
import { bulkAssignProfilesToManagerAction, bulkReassignMerchantsAction, createTeamMemberAction } from "@/lib/actions";
import type { CrmData, Profile, Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";

type UserForm = {
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  manager_id: string;
  agent_code: string;
  sponsor_agent_id: string;
  temp_password: string;
};

export function AdminSettings({ data, currentProfile }: { data: CrmData; currentProfile: Profile }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [fromAgentId, setFromAgentId] = useState("");
  const [toAgentId, setToAgentId] = useState("");
  const [form, setForm] = useState<UserForm>({
    full_name: "",
    email: "",
    phone: "",
    role: "agent",
    manager_id: "",
    agent_code: "",
    sponsor_agent_id: "",
    temp_password: "",
  });

  const managers = data.profiles.filter((profile) => profile.role === "manager" || profile.role === "admin");
  const assignableProfiles = data.profiles.filter((profile) => profile.role !== "admin");
  const sponsors = useMemo(
    () =>
      data.agents.map((agent) => {
        const profile = data.profiles.find((item) => item.id === agent.profile_id);
        return { id: agent.id, label: profile?.full_name ?? agent.agent_code };
      }),
    [data.agents, data.profiles],
  );
  const agentOptions = useMemo(
    () =>
      data.agents.map((agent) => {
        const profile = data.profiles.find((item) => item.id === agent.profile_id);
        const merchantCount = data.merchants.filter((merchant) => merchant.assigned_agent_id === agent.id).length;
        return { id: agent.id, label: profile?.full_name ?? agent.agent_code, merchantCount };
      }),
    [data.agents, data.merchants, data.profiles],
  );

  function update<TKey extends keyof UserForm>(key: TKey, value: UserForm[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function createUser() {
    startTransition(async () => {
      const result = await createTeamMemberAction({
        ...form,
        status: "active",
        manager_id: form.manager_id || undefined,
        sponsor_agent_id: form.sponsor_agent_id || undefined,
      });
      setMessage(result.message);
      if (result.ok) {
        setForm({
          full_name: "",
          email: "",
          phone: "",
          role: "agent",
          manager_id: "",
          agent_code: "",
          sponsor_agent_id: "",
          temp_password: "",
        });
      }
    });
  }

  function toggleProfile(profileId: string) {
    setSelectedProfileIds((current) =>
      current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId],
    );
  }

  function assignManagers() {
    startTransition(async () => {
      const result = await bulkAssignProfilesToManagerAction({
        profile_ids: selectedProfileIds,
        manager_id: selectedManagerId || null,
      });
      setMessage(result.message);
      if (result.ok) setSelectedProfileIds([]);
    });
  }

  function reassignMerchants() {
    startTransition(async () => {
      const result = await bulkReassignMerchantsAction({
        from_agent_id: fromAgentId,
        to_agent_id: toAgentId,
      });
      setMessage(result.message);
      if (result.ok) {
        setFromAgentId("");
        setToAgentId("");
      }
    });
  }

  if (currentProfile.role !== "admin") {
    return null;
  }

  return (
    <section id="admin-settings" className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <Card>
        <CardHeader>
          <CardTitle>Create User / Agent</CardTitle>
          <CardDescription>Create Auth users, profiles, agent records, and recruited team placement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Full name">
              <Input value={form.full_name} onChange={(event) => update("full_name", event.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
            </Field>
            <Field label="Role">
              <Select value={form.role} onChange={(event) => update("role", event.target.value as Role)}>
                <option value="agent">Agent</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
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
            {form.role === "agent" ? (
              <>
                <Field label="Agent code">
                  <Input value={form.agent_code} onChange={(event) => update("agent_code", event.target.value)} placeholder="Auto-generated if blank" />
                </Field>
                <Field label="Sponsor agent">
                  <Select value={form.sponsor_agent_id} onChange={(event) => update("sponsor_agent_id", event.target.value)}>
                    <option value="">No sponsor</option>
                    {sponsors.map((sponsor) => (
                      <option key={sponsor.id} value={sponsor.id}>
                        {sponsor.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}
            <Field label="Temporary password">
              <Input type="password" value={form.temp_password} onChange={(event) => update("temp_password", event.target.value)} />
            </Field>
          </div>
          {message ? <p className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">{message}</p> : null}
          <Button className="w-full" onClick={createUser} disabled={isPending}>
            <UserPlus className="h-4 w-4" />
            Create User
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manager Assignment</CardTitle>
          <CardDescription>Assign agents and managers to a manager for visibility, task ownership, and coaching.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Manager">
            <Select value={selectedManagerId} onChange={(event) => setSelectedManagerId(event.target.value)}>
              <option value="">No manager</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="crm-panel max-h-72 space-y-2 overflow-y-auto rounded-[24px] p-2">
            {assignableProfiles.map((profile) => {
              const manager = data.profiles.find((item) => item.id === profile.manager_id);
              return (
                <label key={profile.id} className="flex items-start gap-3 rounded-2xl p-2 text-sm hover:bg-white/65">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[#0E5EC9]"
                    checked={selectedProfileIds.includes(profile.id)}
                    onChange={() => toggleProfile(profile.id)}
                  />
                  <span>
                    <span className="block font-semibold text-[#0B0F15]">{profile.full_name}</span>
                    <span className="text-[#25425E]/70">{profile.role} · {manager?.full_name ?? "No manager"}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <Button className="w-full" onClick={assignManagers} disabled={isPending || !selectedProfileIds.length}>
            <UsersRound className="h-4 w-4" />
            Assign Selected
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Merchant Reassignment</CardTitle>
          <CardDescription>Move a full merchant book from one agent to another and keep deals aligned.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="From agent">
            <Select value={fromAgentId} onChange={(event) => setFromAgentId(event.target.value)}>
              <option value="">Choose source agent</option>
              {agentOptions.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.label} · {agent.merchantCount} merchants
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To agent">
            <Select value={toAgentId} onChange={(event) => setToAgentId(event.target.value)}>
              <option value="">Choose destination agent</option>
              {agentOptions.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button className="w-full" onClick={reassignMerchants} disabled={isPending || !fromAgentId || !toAgentId || fromAgentId === toAgentId}>
            <ArrowRightLeft className="h-4 w-4" />
            Reassign Merchant Book
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access Directory</CardTitle>
          <CardDescription>Active CRM users and agent records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.profiles.map((profile) => {
            const agent = data.agents.find((item) => item.profile_id === profile.id);
            return (
              <div key={profile.id} className="crm-panel grid gap-3 rounded-[24px] p-4 md:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#0B0F15]">{profile.full_name}</p>
                    <Badge tone={profile.role === "admin" ? "amber" : profile.role === "manager" ? "blue" : "slate"}>{profile.role}</Badge>
                    <Badge>{profile.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[#25425E]/70">{profile.email}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#25425E]/70">
                  <KeyRound className="h-4 w-4" />
                  {agent?.agent_code ?? "No agent record"}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
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
