"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  BrainCircuit,
  CheckCircle2,
  DatabaseBackup,
  Download,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  bulkAssignProfilesToManagerAction,
  bulkReassignMerchantsAction,
  createTeamMemberAction,
  updateEnterpriseSettingsAction,
  updateRolePermissionsAction,
} from "@/lib/actions";
import {
  enterpriseSettingDefaults,
  hydrateEnterpriseSettings,
  hydrateRolePermissions,
  permissionCatalog,
  permissionCategories,
  type PermissionKey,
} from "@/lib/permissions";
import type { CrmData, EnterpriseSetting, Profile, Role, RolePermission } from "@/lib/types";
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

type PermissionDraft = Record<Role, Record<PermissionKey, boolean>>;
type EnterpriseDraft = Record<string, Record<string, unknown>>;

const editableRoles: Role[] = ["agent", "manager", "admin"];

export function AdminSettings({ data, currentProfile }: { data: CrmData; currentProfile: Profile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [fromAgentId, setFromAgentId] = useState("");
  const [toAgentId, setToAgentId] = useState("");
  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft>(() => buildPermissionDraft(data.rolePermissions));
  const [enterpriseDraft, setEnterpriseDraft] = useState<EnterpriseDraft>(() => buildEnterpriseDraft(data.enterpriseSettings));
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
  const hydratedPermissions = useMemo(() => hydrateRolePermissions(data.rolePermissions), [data.rolePermissions]);
  const hydratedEnterpriseSettings = useMemo(() => hydrateEnterpriseSettings(data.enterpriseSettings), [data.enterpriseSettings]);
  const enabledPermissionCounts = editableRoles.map((role) => ({
    role,
    count: permissionCatalog.filter((permission) => permissionDraft[role]?.[permission.key]).length,
  }));
  const canExportCopilotMemory = enterpriseDraft.copilot_memory_export_enabled?.enabled !== false;
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
    if (!form.full_name.trim() || !form.email.trim() || form.temp_password.length < 8) {
      setMessage("Add a name, valid email, and temporary password with at least 8 characters.");
      return;
    }

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
        router.refresh();
      }
    });
  }

  function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const symbols = "!@$%";
    const password = Array.from({ length: 14 }, () => alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length]).join("");
    const finalPassword = `${password}${symbols[crypto.getRandomValues(new Uint32Array(1))[0] % symbols.length]}8`;
    update("temp_password", finalPassword);
    setMessage("Temporary password generated. Share it with the new user through a secure channel.");
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

  function togglePermission(role: Role, permissionKey: PermissionKey) {
    const permission = permissionCatalog.find((item) => item.key === permissionKey);
    if (role === "admin" && permission?.critical) {
      setMessage("Admin dashboard and access-control permissions stay enabled to prevent lockout.");
      return;
    }
    if (role !== "admin" && permission?.adminOnly) {
      setMessage("This permission is admin-only for enterprise security.");
      return;
    }

    setPermissionDraft((current) => ({
      ...current,
      [role]: {
        ...current[role],
        [permissionKey]: !current[role][permissionKey],
      },
    }));
  }

  function saveRolePermissions(role: Role) {
    startTransition(async () => {
      const result = await updateRolePermissionsAction({
        role,
        permissions: permissionCatalog.map((permission) => ({
          permission_key: permission.key,
          enabled: permissionDraft[role][permission.key],
        })),
      });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function saveAllRolePermissions() {
    startTransition(async () => {
      for (const role of editableRoles) {
        const result = await updateRolePermissionsAction({
          role,
          permissions: permissionCatalog.map((permission) => ({
            permission_key: permission.key,
            enabled: permissionDraft[role][permission.key],
          })),
        });
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
      }
      setMessage("All role access settings were saved.");
      router.refresh();
    });
  }

  function updateEnterpriseSetting(settingKey: string, field: string, value: unknown) {
    setEnterpriseDraft((current) => ({
      ...current,
      [settingKey]: {
        ...(current[settingKey] ?? {}),
        [field]: value,
      },
    }));
  }

  function saveEnterpriseSettings() {
    startTransition(async () => {
      const result = await updateEnterpriseSettingsAction({
        settings: enterpriseSettingDefaults.map((setting) => ({
          setting_key: setting.setting_key,
          setting_value: enterpriseDraft[setting.setting_key] ?? setting.setting_value,
          description: setting.description ?? undefined,
        })),
      });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  async function exportCopilotKnowledge() {
    setMessage("Preparing Copilot memory export...");
    try {
      const response = await fetch("/api/copilot/knowledge/export");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? "Copilot memory export failed.");
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `merchantdesk-copilot-memory-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${payload.counts?.memories ?? data.copilotMemories.length} Copilot memory records.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Copilot memory export failed.");
    }
  }

  if (currentProfile.role !== "admin") {
    return null;
  }

  return (
    <section id="admin-settings" className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <Card className="xl:col-span-2">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Enterprise Access Control</CardTitle>
              <CardDescription>Configure exactly what agents, managers, and admins can see or operate.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {enabledPermissionCounts.map((item) => (
                <Badge key={item.role} tone={item.role === "admin" ? "amber" : item.role === "manager" ? "blue" : "slate"}>
                  {item.role}: {item.count}
                </Badge>
              ))}
              <Button type="button" onClick={saveAllRolePermissions} disabled={isPending}>
                <Save className="h-4 w-4" />
                Save All Access
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {permissionCategories.map((category) => (
            <div key={category} className="crm-panel overflow-hidden rounded-[24px]">
              <div className="flex items-center justify-between border-b border-[#ABB7C0]/25 bg-white/55 px-4 py-3">
                <p className="text-sm font-black uppercase tracking-wide text-[#25425E]">{category}</p>
                <div className="hidden grid-cols-3 gap-3 text-center text-xs font-black uppercase text-[#25425E]/70 sm:grid sm:w-72">
                  <span>Agent</span>
                  <span>Manager</span>
                  <span>Admin</span>
                </div>
              </div>
              <div className="divide-y divide-[#ABB7C0]/20">
                {permissionCatalog
                  .filter((permission) => permission.category === category)
                  .map((permission) => (
                    <div key={permission.key} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_18rem] sm:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[#0B0F15]">{permission.label}</p>
                          {permission.critical ? <Badge tone="amber">Protected</Badge> : null}
                          {permission.adminOnly ? <Badge tone="slate">Admin only</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[#25425E]/70">{permission.description}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {editableRoles.map((role) => {
                          const locked = (role === "admin" && Boolean(permission.critical)) || (role !== "admin" && Boolean(permission.adminOnly));
                          const checked = Boolean(permissionDraft[role]?.[permission.key]);
                          return (
                            <label
                              key={`${role}-${permission.key}`}
                              className={`flex h-11 items-center justify-center rounded-full border text-sm font-semibold transition ${
                                checked
                                  ? "border-[#0E5EC9]/25 bg-[#0E5EC9]/10 text-[#0E5EC9]"
                                  : "border-[#ABB7C0]/30 bg-white/60 text-[#25425E]/65"
                              } ${locked ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:bg-white"}`}
                              title={permission.adminOnly && role !== "admin" ? "Admin-only permission" : locked ? "Protected for admins" : `${role} access`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                disabled={locked}
                                onChange={() => togglePermission(role, permission.key)}
                              />
                              {checked ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-4 w-4 rounded-full border border-current" />}
                              <span className="ml-2 capitalize sm:hidden">{role}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          <div className="grid gap-3 md:grid-cols-3">
            {editableRoles.map((role) => (
              <Button key={role} variant="secondary" type="button" onClick={() => saveRolePermissions(role)} disabled={isPending}>
                <ShieldCheck className="h-4 w-4" />
                Save {role}
              </Button>
            ))}
          </div>
          <div className="crm-panel rounded-[24px] p-4 text-sm leading-6 text-[#25425E]">
            <LockKeyhole className="mr-2 inline h-4 w-4 text-[#0E5EC9]" />
            Navigation and direct page access use these settings. Sensitive server-side actions still check role and RLS rules.
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Enterprise Policy Controls</CardTitle>
              <CardDescription>Operational controls that prepare MerchantDesk for larger teams, audits, and integrations.</CardDescription>
            </div>
            <Button type="button" onClick={saveEnterpriseSettings} disabled={isPending}>
              <Save className="h-4 w-4" />
              Save Policies
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-3 md:grid-cols-2">
            <EnterpriseToggle
              label="Require MFA for admins/managers"
              description={settingDescription(hydratedEnterpriseSettings, "require_mfa_for_admins")}
              checked={Boolean(enterpriseDraft.require_mfa_for_admins?.enabled)}
              onChange={(checked) => updateEnterpriseSetting("require_mfa_for_admins", "enabled", checked)}
            />
            <EnterpriseToggle
              label="Restrict exports to leadership"
              description={settingDescription(hydratedEnterpriseSettings, "restrict_exports_to_leadership")}
              checked={Boolean(enterpriseDraft.restrict_exports_to_leadership?.enabled)}
              onChange={(checked) => updateEnterpriseSetting("restrict_exports_to_leadership", "enabled", checked)}
            />
            <EnterpriseToggle
              label="Audit sensitive actions"
              description={settingDescription(hydratedEnterpriseSettings, "audit_sensitive_actions")}
              checked={Boolean(enterpriseDraft.audit_sensitive_actions?.enabled)}
              onChange={(checked) => updateEnterpriseSetting("audit_sensitive_actions", "enabled", checked)}
            />
            <EnterpriseToggle
              label="Enable external API access"
              description={settingDescription(hydratedEnterpriseSettings, "api_access_enabled")}
              checked={Boolean(enterpriseDraft.api_access_enabled?.enabled)}
              onChange={(checked) => updateEnterpriseSetting("api_access_enabled", "enabled", checked)}
            />
            <EnterpriseToggle
              label="Enable processor sync"
              description={settingDescription(hydratedEnterpriseSettings, "processor_sync_enabled")}
              checked={Boolean(enterpriseDraft.processor_sync_enabled?.enabled)}
              onChange={(checked) => updateEnterpriseSetting("processor_sync_enabled", "enabled", checked)}
            />
            <EnterpriseToggle
              label="Underwriting auto-decisions"
              description={settingDescription(hydratedEnterpriseSettings, "underwriting_auto_decisions_enabled")}
              checked={Boolean(enterpriseDraft.underwriting_auto_decisions_enabled?.enabled)}
              onChange={(checked) => updateEnterpriseSetting("underwriting_auto_decisions_enabled", "enabled", checked)}
            />
            <EnterpriseToggle
              label="Payroll exports"
              description={settingDescription(hydratedEnterpriseSettings, "payroll_exports_enabled")}
              checked={Boolean(enterpriseDraft.payroll_exports_enabled?.enabled)}
              onChange={(checked) => updateEnterpriseSetting("payroll_exports_enabled", "enabled", checked)}
            />
            <EnterpriseToggle
              label="Copilot company learning"
              description={settingDescription(hydratedEnterpriseSettings, "copilot_learning_enabled")}
              checked={Boolean(enterpriseDraft.copilot_learning_enabled?.enabled)}
              onChange={(checked) => updateEnterpriseSetting("copilot_learning_enabled", "enabled", checked)}
            />
            <EnterpriseToggle
              label="Copilot memory export"
              description={settingDescription(hydratedEnterpriseSettings, "copilot_memory_export_enabled")}
              checked={Boolean(enterpriseDraft.copilot_memory_export_enabled?.enabled)}
              onChange={(checked) => updateEnterpriseSetting("copilot_memory_export_enabled", "enabled", checked)}
            />
            <Field label="Copilot model">
              <Input
                value={String(enterpriseDraft.copilot_model?.model ?? "gpt-5.4")}
                onChange={(event) => updateEnterpriseSetting("copilot_model", "model", event.target.value || "gpt-5.4")}
              />
            </Field>
            <Field label="Copilot reasoning">
              <Select
                value={String(enterpriseDraft.copilot_model?.reasoning ?? "medium")}
                onChange={(event) => updateEnterpriseSetting("copilot_model", "reasoning", event.target.value)}
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">Extra high</option>
              </Select>
            </Field>
            <Field label="Session timeout target">
              <Input
                type="number"
                min="15"
                max="720"
                value={String(enterpriseDraft.session_timeout_minutes?.minutes ?? 60)}
                onChange={(event) => updateEnterpriseSetting("session_timeout_minutes", "minutes", Number(event.target.value) || 60)}
              />
            </Field>
            <Field label="Team recruit limit">
              <Input
                type="number"
                min="1"
                max="12"
                value={String(enterpriseDraft.team_recruit_limit?.limit ?? 4)}
                onChange={(event) => updateEnterpriseSetting("team_recruit_limit", "limit", Number(event.target.value) || 4)}
              />
            </Field>
            <Field label="Data retention target">
              <Input
                type="number"
                min="1"
                max="10"
                value={String(enterpriseDraft.data_retention_years?.years ?? 7)}
                onChange={(event) => updateEnterpriseSetting("data_retention_years", "years", Number(event.target.value) || 7)}
              />
            </Field>
          </div>

          <div className="space-y-3">
            <EnterpriseStat icon={<UsersRound className="h-4 w-4" />} label="Active users" value={data.profiles.filter((profile) => profile.status === "active").length.toString()} />
            <EnterpriseStat icon={<ShieldCheck className="h-4 w-4" />} label="Permission records" value={hydratedPermissions.length.toString()} />
            <EnterpriseStat icon={<BrainCircuit className="h-4 w-4" />} label="Copilot memories" value={data.copilotMemories.length.toString()} />
            <EnterpriseStat icon={<DatabaseBackup className="h-4 w-4" />} label="Audit events" value={data.auditLogs.length.toString()} />
            <EnterpriseStat icon={<KeyRound className="h-4 w-4" />} label="API policy" value={enterpriseDraft.api_access_enabled?.enabled ? "Enabled" : "Disabled"} />
            <Button
              className="w-full rounded-full"
              variant="secondary"
              type="button"
              onClick={exportCopilotKnowledge}
              disabled={!canExportCopilotMemory}
              title={canExportCopilotMemory ? "Export retained Copilot memory" : "Enable Copilot memory export policy first"}
            >
              <Download className="h-4 w-4" />
              Export Copilot Memory
            </Button>
          </div>
        </CardContent>
      </Card>

      {message ? (
        <div className="crm-panel xl:col-span-2 rounded-[24px] border-[#0E5EC9]/20 bg-[#0E5EC9]/10 p-4 text-sm font-semibold text-[#25425E]">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Create User / Agent</CardTitle>
          <CardDescription>Create Auth users, profiles, agent records, and recruited team placement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Full name">
              <Input value={form.full_name} onChange={(event) => update("full_name", event.target.value)} placeholder="Jane Doe" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="jane@company.com" />
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
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={form.temp_password}
                  onChange={(event) => update("temp_password", event.target.value)}
                  placeholder="Minimum 8 characters"
                />
                <Button variant="secondary" type="button" onClick={generatePassword} disabled={isPending}>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </Button>
              </div>
            </Field>
          </div>
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

function buildPermissionDraft(rows: RolePermission[]): PermissionDraft {
  const hydratedRows = hydrateRolePermissions(rows);
  const draft = {} as PermissionDraft;

  for (const role of editableRoles) {
    draft[role] = {} as Record<PermissionKey, boolean>;
    for (const permission of permissionCatalog) {
      draft[role][permission.key] =
        hydratedRows.find((row) => row.role === role && row.permission_key === permission.key)?.enabled ?? false;
    }
  }

  return draft;
}

function buildEnterpriseDraft(rows: EnterpriseSetting[]): EnterpriseDraft {
  return Object.fromEntries(hydrateEnterpriseSettings(rows).map((setting) => [setting.setting_key, setting.setting_value])) as EnterpriseDraft;
}

function settingDescription(settings: EnterpriseSetting[], settingKey: string) {
  return settings.find((setting) => setting.setting_key === settingKey)?.description ?? "";
}

function EnterpriseToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="crm-panel flex cursor-pointer items-start justify-between gap-4 rounded-[24px] p-4 transition hover:-translate-y-0.5 hover:bg-white/70">
      <span>
        <span className="block font-semibold text-[#0B0F15]">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-[#25425E]/70">{description}</span>
      </span>
      <span className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[#0E5EC9]" : "bg-[#ABB7C0]/45"}`}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </label>
  );
}

function EnterpriseStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="crm-panel flex items-center justify-between gap-4 rounded-[24px] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#0E5EC9] shadow-sm">{icon}</span>
        <span className="text-sm font-semibold text-[#25425E]/70">{label}</span>
      </div>
      <span className="text-lg font-black text-[#0B0F15]">{value}</span>
    </div>
  );
}
