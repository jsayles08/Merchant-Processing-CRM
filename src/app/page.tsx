import { AppShell } from "@/components/app-shell";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getCrmPageContext } from "@/lib/page-context";

export default async function Home() {
  const { profile, data } = await getCrmPageContext();

  return (
    <AppShell profile={profile} title="Customer Information" eyebrow="MerchantDesk CRM" activeHref="/">
      <div className="mx-auto max-w-[1520px]">
        <DashboardOverview data={data} />
      </div>
    </AppShell>
  );
}
