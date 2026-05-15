import { AppShell } from "@/components/app-shell";
import { CrmAnalytics } from "@/components/analytics/crm-analytics";
import { getCrmPageContext } from "@/lib/page-context";

export default async function AnalyticsPage() {
  const { profile, data } = await getCrmPageContext("analytics.view");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Analytics" eyebrow="Workflow intelligence" activeHref="/analytics">
      <CrmAnalytics data={data} />
    </AppShell>
  );
}
