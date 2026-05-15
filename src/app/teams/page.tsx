import { AppShell } from "@/components/app-shell";
import { TeamWorkspace } from "@/components/teams/team-workspace";
import { getCrmPageContext } from "@/lib/page-context";

export default async function TeamsPage() {
  const { profile, data } = await getCrmPageContext("teams.view");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Teams" eyebrow="Roster and recruiting progress" activeHref="/teams">
      <div className="w-full">
        <TeamWorkspace data={data} currentProfileId={profile.id} />
      </div>
    </AppShell>
  );
}
