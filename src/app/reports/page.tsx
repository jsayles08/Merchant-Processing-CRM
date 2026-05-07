import { AppShell } from "@/components/app-shell";
import { BusinessReports } from "@/components/reports/business-reports";
import { getCrmPageContext } from "@/lib/page-context";

export default async function ReportsPage() {
  const { profile, data } = await getCrmPageContext();

  return (
    <AppShell profile={profile} title="Reports" eyebrow="Business intelligence" activeHref="/reports">
      <div className="mx-auto max-w-[1500px]">
        <BusinessReports data={data} currentProfile={profile} />
      </div>
    </AppShell>
  );
}
