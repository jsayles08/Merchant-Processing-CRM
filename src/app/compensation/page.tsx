import { AppShell } from "@/components/app-shell";
import { CompensationOverview } from "@/components/compensation/compensation-overview";
import { getCrmPageContext } from "@/lib/page-context";

export default async function CompensationPage() {
  const { profile, data, currentAgentId } = await getCrmPageContext("compensation.view");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Compensation" eyebrow="Residuals and overrides" activeHref="/compensation">
      <div className="w-full">
        <CompensationOverview data={data} currentAgentId={currentAgentId} currentProfile={profile} />
      </div>
    </AppShell>
  );
}
