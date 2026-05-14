import { AppShell } from "@/components/app-shell";
import { CrmAnalytics } from "@/components/analytics/crm-analytics";
import { getCrmPageContext } from "@/lib/page-context";

export default async function AnalyticsPage() {
  const { profile, data } = await getCrmPageContext();

  return (
    <AppShell profile={profile} title="Analytics" eyebrow="Workflow intelligence" activeHref="/analytics">
      <CrmAnalytics data={data} />
    </AppShell>
  );
}
