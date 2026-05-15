"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cable,
  CheckCircle2,
  KeyRound,
  Link2,
  PlugZap,
  RefreshCcw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import type { ProcessorProviderDefinition } from "@/lib/processor-integrations";
import type { CrmData, ProcessorAuthType, ProcessorConnection, ProcessorProviderId, Profile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/field";

type ConnectionForm = {
  provider: ProcessorProviderId;
  display_name: string;
  account_identifier: string;
  auth_type: ProcessorAuthType;
  environment: "sandbox" | "production";
  agent_profile_id: string;
  apiKey: string;
  apiSecret: string;
  merchantId: string;
  username: string;
  credentialSecret: string;
  oauthCode: string;
};

const defaultForm: ConnectionForm = {
  provider: "fiserv",
  display_name: "Fiserv portfolio",
  account_identifier: "",
  auth_type: "api_key",
  environment: "sandbox",
  agent_profile_id: "",
  apiKey: "",
  apiSecret: "",
  merchantId: "",
  username: "",
  credentialSecret: "",
  oauthCode: "",
};

export function ProcessorConnections({
  data,
  currentProfile,
  providers,
}: {
  data: CrmData;
  currentProfile: Profile;
  providers: ProcessorProviderDefinition[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<ConnectionForm>(() => ({ ...defaultForm, agent_profile_id: currentProfile.id }));
  const selectedProvider = providers.find((provider) => provider.id === form.provider) ?? providers[0];
  const profilesById = useMemo(() => new Map(data.profiles.map((profile) => [profile.id, profile])), [data.profiles]);
  const visibleConnections = data.processorConnections;
  const activeCount = visibleConnections.filter((connection) => connection.status === "connected").length;
  const errorCount = visibleConnections.filter((connection) => connection.status === "error").length;

  function update<TKey extends keyof ConnectionForm>(key: TKey, value: ConnectionForm[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProvider(providerId: ProcessorProviderId) {
    const provider = providers.find((item) => item.id === providerId);
    setForm((current) => ({
      ...current,
      provider: providerId,
      display_name: provider ? `${provider.name} account` : current.display_name,
      auth_type: provider?.supportedAuthTypes.includes(current.auth_type) ? current.auth_type : provider?.supportedAuthTypes[0] ?? "api_key",
    }));
  }

  function connectAccount() {
    if (!form.display_name.trim() || !form.account_identifier.trim()) {
      setMessage("Add a display name and account identifier before connecting.");
      return;
    }

    startTransition(async () => {
      setMessage("Connecting processor account...");
      const response = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          display_name: form.display_name,
          account_identifier: form.account_identifier,
          agent_profile_id: form.agent_profile_id,
          auth_type: form.auth_type,
          environment: form.environment,
          credentials: {
            apiKey: form.apiKey,
            apiSecret: form.apiSecret,
            merchantId: form.merchantId,
            username: form.username,
            credentialSecret: form.credentialSecret,
            oauthCode: form.oauthCode,
          },
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Processor account was not connected.");
        return;
      }

      setMessage(payload.message ?? "Processor account connected.");
      setForm((current) => ({
        ...defaultForm,
        provider: current.provider,
        display_name: `${selectedProvider.name} account`,
        agent_profile_id: currentProfile.id,
      }));
      router.refresh();
    });
  }

  function runConnectionAction(connection: ProcessorConnection, action: "test" | "sync" | "disconnect") {
    startTransition(async () => {
      setMessage(`${actionLabel(action)} ${connection.display_name}...`);
      const response = await fetch(`/api/integrations/connections/${connection.id}/${action}`, { method: "POST" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? payload.message ?? `${actionLabel(action)} failed.`);
        return;
      }

      setMessage(payload.message ?? `${connection.display_name} updated.`);
      router.refresh();
    });
  }

  function startOAuth() {
    window.location.href = `/api/integrations/oauth/${form.provider}/start`;
  }

  return (
    <section id="processor-connections" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Processor Connections</CardTitle>
              <CardDescription>Connect Fiserv, Nuvei, or other processor accounts with encrypted credentials.</CardDescription>
            </div>
            <Badge tone="blue">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secrets encrypted
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <ConnectionStat label="Connections" value={visibleConnections.length.toString()} />
            <ConnectionStat label="Connected" value={activeCount.toString()} />
            <ConnectionStat label="Needs attention" value={errorCount.toString()} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Provider">
              <Select value={form.provider} onChange={(event) => updateProvider(event.target.value as ProcessorProviderId)}>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Environment">
              <Select value={form.environment} onChange={(event) => update("environment", event.target.value as ConnectionForm["environment"])}>
                <option value="sandbox">Sandbox / test</option>
                <option value="production">Production</option>
              </Select>
            </Field>
            <Field label="Display name">
              <Input value={form.display_name} onChange={(event) => update("display_name", event.target.value)} placeholder="Fiserv Buffalo portfolio" />
            </Field>
            <Field label="Account identifier">
              <Input value={form.account_identifier} onChange={(event) => update("account_identifier", event.target.value)} placeholder="MID, portfolio ID, or DBA" />
            </Field>
            <Field label="Auth method">
              <Select value={form.auth_type} onChange={(event) => update("auth_type", event.target.value as ProcessorAuthType)}>
                {selectedProvider.supportedAuthTypes.map((authType) => (
                  <option key={authType} value={authType}>
                    {formatAuthType(authType)}
                  </option>
                ))}
              </Select>
            </Field>
            {currentProfile.role === "admin" ? (
              <Field label="Agent owner">
                <Select value={form.agent_profile_id} onChange={(event) => update("agent_profile_id", event.target.value)}>
                  {data.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name} ({profile.role})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>

          <div className="crm-panel rounded-[24px] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-[#0B0F15]">{selectedProvider.name}</p>
                <p className="mt-1 text-sm text-[#25425E]/70">{selectedProvider.description}</p>
              </div>
              {selectedProvider.supportsOAuth ? (
                <Button type="button" variant="secondary" onClick={startOAuth} disabled={!selectedProvider.oauthConfigured || isPending}>
                  <Link2 className="h-4 w-4" />
                  OAuth
                </Button>
              ) : null}
            </div>

            {selectedProvider.supportsOAuth && !selectedProvider.oauthConfigured ? (
              <div className="mb-4 rounded-2xl border border-[#E9D7A1]/60 bg-[#E9D7A1]/35 p-3 text-sm text-[#6F461D]">
                OAuth is available for this provider, but client ID and redirect URI env vars are not configured yet.
              </div>
            ) : null}

            {form.auth_type === "oauth" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="OAuth authorization code">
                  <Input type="password" value={form.oauthCode} onChange={(event) => update("oauthCode", event.target.value)} placeholder="Paste provider code" />
                </Field>
                <div className="flex items-end">
                  <p className="rounded-2xl bg-white/55 p-3 text-sm leading-6 text-[#25425E]/70">
                    Use OAuth where the provider supports it. Token exchange is isolated behind the provider adapter.
                  </p>
                </div>
              </div>
            ) : form.auth_type === "api_key" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="API key">
                  <Input type="password" value={form.apiKey} onChange={(event) => update("apiKey", event.target.value)} placeholder="Stored encrypted" />
                </Field>
                <Field label="API secret / token">
                  <Input type="password" value={form.apiSecret} onChange={(event) => update("apiSecret", event.target.value)} placeholder="Optional, encrypted" />
                </Field>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Merchant ID">
                  <Input value={form.merchantId} onChange={(event) => update("merchantId", event.target.value)} />
                </Field>
                <Field label="Username">
                  <Input value={form.username} onChange={(event) => update("username", event.target.value)} />
                </Field>
                <Field label="Credential secret">
                  <Input type="password" value={form.credentialSecret} onChange={(event) => update("credentialSecret", event.target.value)} />
                </Field>
              </div>
            )}
          </div>

          <Button type="button" onClick={connectAccount} disabled={isPending}>
            <PlugZap className="h-4 w-4" />
            Connect Account
          </Button>

          {message ? <p className="rounded-2xl bg-white/60 p-3 text-sm font-semibold text-[#25425E]">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>Test, sync, or disconnect provider access without exposing stored secrets.</CardDescription>
        </CardHeader>
        <CardContent>
          {visibleConnections.length ? (
            <div className="space-y-3">
              {visibleConnections.map((connection) => {
                const owner = profilesById.get(connection.agent_profile_id);
                const provider = providers.find((item) => item.id === connection.provider);
                return (
                  <div key={connection.id} className="crm-panel rounded-[24px] p-4 transition-all duration-200 hover:-translate-y-1">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0B0F15] text-white">
                            <Cable className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-bold text-[#0B0F15]">{connection.display_name}</p>
                            <p className="text-sm text-[#25425E]/70">
                              {provider?.name ?? connection.provider} · {connection.account_identifier}
                            </p>
                          </div>
                          <Badge tone={statusTone(connection.status)}>{connection.status}</Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-[#25425E] sm:grid-cols-2">
                          <span>Owner: {owner?.full_name ?? "Unknown"}</span>
                          <span>Auth: {formatAuthType(connection.auth_type)}</span>
                          <span>Last tested: {formatDateTime(connection.last_tested_at)}</span>
                          <span>Last sync: {formatDateTime(connection.last_sync_at)}</span>
                        </div>
                        {connection.last_error ? <p className="mt-2 text-sm font-semibold text-[#9F4E16]">{connection.last_error}</p> : null}
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button type="button" variant="secondary" size="sm" onClick={() => runConnectionAction(connection, "test")} disabled={isPending}>
                          <CheckCircle2 className="h-4 w-4" />
                          Test
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => runConnectionAction(connection, "sync")} disabled={isPending || connection.status === "disconnected"}>
                          <RefreshCcw className="h-4 w-4" />
                          Sync
                        </Button>
                        <Button type="button" variant="danger" size="sm" onClick={() => runConnectionAction(connection, "disconnect")} disabled={isPending || connection.status === "disconnected"}>
                          <Unplug className="h-4 w-4" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<KeyRound className="h-5 w-5" />}
              title="No processor accounts connected"
              description="Connect Fiserv, Nuvei, or another provider to prepare automated portfolio and residual sync."
            />
          )}
        </CardContent>
      </Card>
    </section>
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

function ConnectionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-panel rounded-[22px] p-3">
      <p className="text-xs font-semibold uppercase text-[#25425E]/65">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#0B0F15]">{value}</p>
    </div>
  );
}

function formatAuthType(authType: ProcessorAuthType) {
  return authType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status: ProcessorConnection["status"]) {
  if (status === "connected") return "blue";
  if (status === "syncing") return "amber";
  if (status === "error") return "rose";
  return "slate";
}

function actionLabel(action: "test" | "sync" | "disconnect") {
  if (action === "test") return "Testing";
  if (action === "sync") return "Syncing";
  return "Disconnecting";
}
