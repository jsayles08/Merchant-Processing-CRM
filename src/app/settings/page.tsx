import { AppShell } from "@/components/app-shell";
import { AdminSettings } from "@/components/admin/admin-settings";
import { AgentActivityMonitor } from "@/components/settings/agent-activity-monitor";
import { ProcessorConnections } from "@/components/settings/processor-connections";
import { getCrmPageContext } from "@/lib/page-context";
import { getProcessorProviderSummaries } from "@/lib/processor-integrations";

export default async function SettingsPage() {
  const { profile, data } = await getCrmPageContext("processor_connections.manage");
  const providers = getProcessorProviderSummaries();

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Settings" eyebrow="Integrations and controls" activeHref="/settings">
      <div className="w-full space-y-6">
        <ProcessorConnections data={data} currentProfile={profile} providers={providers} />
        {profile.role === "admin" ? <AgentActivityMonitor data={data} /> : null}
        <AdminSettings data={data} currentProfile={profile} />
      </div>
    </AppShell>
  );
}
