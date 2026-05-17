import { AgentsWorkspace } from "@/components/agents/agents-workspace";
import { AppShell } from "@/components/app-shell";
import { getCrmPageContext } from "@/lib/page-context";
import { hasPermission } from "@/lib/permissions";

export default async function AgentsPage() {
  const { profile, data } = await getCrmPageContext("agents.view");
  const canManageAgents = hasPermission(profile.role, data.rolePermissions, "agents.manage");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Agents" eyebrow="Team directory" activeHref="/agents">
      <AgentsWorkspace data={data} currentProfile={profile} canManageAgents={canManageAgents} />
    </AppShell>
  );
}
