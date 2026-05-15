import { AppShell } from "@/components/app-shell";
import { MerchantManager } from "@/components/merchants/merchant-manager";
import { getCrmPageContext } from "@/lib/page-context";

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string }>;
}) {
  const { profile, data, currentAgentId } = await getCrmPageContext("merchants.view");
  const params = await searchParams;

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Merchants" eyebrow="Sales workspace" activeHref="/merchants">
      <div className="w-full">
        <MerchantManager
          data={data}
          currentProfile={profile}
          currentAgentId={currentAgentId}
          initialSearchQuery={params?.search ?? ""}
        />
      </div>
    </AppShell>
  );
}
