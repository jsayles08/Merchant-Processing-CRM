import { AppShell } from "@/components/app-shell";
import { CrmAnalytics } from "@/components/analytics/crm-analytics";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getCrmPageContext } from "@/lib/page-context";

export default async function DashboardPage() {
  const { profile, data } = await getCrmPageContext("dashboard.view");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Customer Information" eyebrow="MerchantDesk CRM" activeHref="/dashboard">
      <div className="crm-dashboard-page w-full space-y-6">
        <DashboardOverview data={data} />
        <CrmAnalytics data={data} currentProfile={profile} compact />
      </div>
    </AppShell>
  );
}
