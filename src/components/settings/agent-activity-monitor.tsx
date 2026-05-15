"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Clock3, RadioTower, ShieldAlert, UserRoundCheck, UserRoundX } from "lucide-react";
import type { AgentActivityLog, AgentPresence, CrmData, ProcessorConnection } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/field";

type Filters = {
  profileId: string;
  provider: string;
  eventType: string;
  date: string;
};

export function AgentActivityMonitor({ data }: { data: CrmData }) {
  const [filters, setFilters] = useState<Filters>({ profileId: "all", provider: "all", eventType: "all", date: "" });
  const profilesById = useMemo(() => new Map(data.profiles.map((profile) => [profile.id, profile])), [data.profiles]);
  const connectionsByProfile = useMemo(() => groupConnectionsByProfile(data.processorConnections), [data.processorConnections]);
  const presenceByProfile = useMemo(() => new Map(data.agentPresence.map((presence) => [presence.profile_id, presence])), [data.agentPresence]);
  const providers = Array.from(new Set(data.processorConnections.map((connection) => connection.provider))).sort();
  const eventTypes = Array.from(new Set(data.agentActivityLogs.map((log) => log.event_type))).sort();
  const filteredLogs = data.agentActivityLogs.filter((log) => {
    if (filters.profileId !== "all" && log.profile_id !== filters.profileId && log.actor_profile_id !== filters.profileId) return false;
    if (filters.provider !== "all" && log.provider !== filters.provider) return false;
    if (filters.eventType !== "all" && log.event_type !== filters.eventType) return false;
    if (filters.date && !log.created_at.startsWith(filters.date)) return false;
    return true;
  });
  const onlineProfiles = data.profiles.filter((profile) => isOnlinePresence(presenceByProfile.get(profile.id)));
  const offlineProfiles = data.profiles.filter((profile) => !isOnlinePresence(presenceByProfile.get(profile.id)));

  function update<TKey extends keyof Filters>(key: TKey, value: Filters[TKey]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section id="agent-activity" className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Agent Activity & System Logs</CardTitle>
              <CardDescription>Monitor presence, provider health, sync activity, login history, and integration errors.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">
                <UserRoundCheck className="h-3.5 w-3.5" />
                {onlineProfiles.length} online
              </Badge>
              <Badge tone="slate">
                <UserRoundX className="h-3.5 w-3.5" />
                {offlineProfiles.length} offline
              </Badge>
              <Badge tone="rose">
                <AlertTriangle className="h-3.5 w-3.5" />
                {data.agentActivityLogs.filter((log) => log.severity === "error").length} errors
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.profiles.map((profile) => {
              const presence = presenceByProfile.get(profile.id);
              const connections = connectionsByProfile.get(profile.id) ?? [];
              return (
                <div key={profile.id} className="crm-panel rounded-[24px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#0B0F15]">{profile.full_name}</p>
                      <p className="text-sm capitalize text-[#25425E]/70">{profile.role}</p>
                    </div>
                    <PresenceBadge presence={presence} />
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-[#25425E]">
                    <p>Last seen: {formatDateTime(presence?.last_seen_at ?? null)}</p>
                    <p>Path: {presence?.current_path ?? "Not tracked yet"}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {connections.length ? (
                        connections.map((connection) => (
                          <Badge key={connection.id} tone={connection.status === "connected" ? "blue" : connection.status === "error" ? "rose" : "slate"}>
                            {connection.provider}: {connection.status}
                          </Badge>
                        ))
                      ) : (
                        <Badge tone="slate">No providers</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Agent">
              <Select value={filters.profileId} onChange={(event) => update("profileId", event.target.value)}>
                <option value="all">All agents</option>
                {data.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Provider">
              <Select value={filters.provider} onChange={(event) => update("provider", event.target.value)}>
                <option value="all">All providers</option>
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Event type">
              <Select value={filters.eventType} onChange={(event) => update("eventType", event.target.value)}>
                <option value="all">All events</option>
                {eventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventType}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={filters.date} onChange={(event) => update("date", event.target.value)} />
            </Field>
          </div>

          {filteredLogs.length ? (
            <div className="space-y-2">
              {filteredLogs.slice(0, 80).map((log) => {
                const profile = profilesById.get(log.profile_id ?? "");
                return (
                  <div key={log.id} className="crm-panel grid gap-3 rounded-[22px] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityIcon log={log} />
                        <p className="font-semibold text-[#0B0F15]">{log.summary}</p>
                        <Badge tone={severityTone(log.severity)}>{log.severity}</Badge>
                        {log.provider ? <Badge tone="slate">{log.provider}</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-[#25425E]/70">
                        {profile?.full_name ?? "System"} · {log.event_type} · {log.event_source}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#25425E]/70">
                      <Clock3 className="h-4 w-4" />
                      {formatDateTime(log.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title="No activity matches these filters"
              description="Presence, login, processor connection, sync, and API error events will appear here."
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function groupConnectionsByProfile(connections: ProcessorConnection[]) {
  const grouped = new Map<string, ProcessorConnection[]>();
  for (const connection of connections) {
    grouped.set(connection.agent_profile_id, [...(grouped.get(connection.agent_profile_id) ?? []), connection]);
  }
  return grouped;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function PresenceBadge({ presence }: { presence?: AgentPresence }) {
  if (isOnlinePresence(presence)) {
    return (
      <Badge tone="blue">
        <RadioTower className="h-3.5 w-3.5" />
        Online
      </Badge>
    );
  }

  if (presence?.status === "away") {
    return <Badge tone="amber">Away</Badge>;
  }

  return <Badge tone="slate">Offline</Badge>;
}

function SeverityIcon({ log }: { log: AgentActivityLog }) {
  if (log.severity === "error") return <ShieldAlert className="h-4 w-4 text-[#9F4E16]" />;
  if (log.severity === "warning") return <AlertTriangle className="h-4 w-4 text-[#6F461D]" />;
  return <Activity className="h-4 w-4 text-[#0E5EC9]" />;
}

function isOnlinePresence(presence?: AgentPresence) {
  if (!presence) return false;
  return presence.status === "online" && Date.now() - new Date(presence.last_seen_at).getTime() < 5 * 60 * 1000;
}

function severityTone(severity: AgentActivityLog["severity"]) {
  if (severity === "error") return "rose";
  if (severity === "warning" || severity === "security") return "amber";
  return "blue";
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
