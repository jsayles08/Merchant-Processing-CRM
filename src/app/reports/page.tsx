import { AppShell } from "@/components/app-shell";
import { BusinessReports } from "@/components/reports/business-reports";
import { getCrmPageContext } from "@/lib/page-context";

export default async function ReportsPage() {
  const { profile, data } = await getCrmPageContext("reports.view");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Reports" eyebrow="Business intelligence" activeHref="/reports">
      <div className="w-full">
        <BusinessReports data={data} currentProfile={profile} />
      </div>
    </AppShell>
  );
}
