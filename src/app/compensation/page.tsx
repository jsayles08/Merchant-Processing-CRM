import { AppShell } from "@/components/app-shell";
import { CompensationOverview } from "@/components/compensation/compensation-overview";
import { getCrmPageContext } from "@/lib/page-context";

export default async function CompensationPage() {
  const { profile, data, currentAgentId } = await getCrmPageContext();

  return (
    <AppShell profile={profile} title="Compensation" eyebrow="Residuals and overrides" activeHref="/compensation">
      <div className="w-full">
        <CompensationOverview data={data} currentAgentId={currentAgentId} />
      </div>
    </AppShell>
  );
}
