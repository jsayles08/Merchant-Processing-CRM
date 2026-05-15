import { AppShell } from "@/components/app-shell";
import { MerchantOnboardingWorkspace } from "@/components/onboarding/merchant-onboarding-workspace";
import { getCrmPageContext } from "@/lib/page-context";

export default async function MerchantOnboardingPage() {
  const { profile, data, currentAgentId } = await getCrmPageContext("merchant_onboarding.view");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Merchant Onboarding" eyebrow="Application workflow" activeHref="/merchant-onboarding">
      <MerchantOnboardingWorkspace data={data} currentAgentId={currentAgentId} />
    </AppShell>
  );
}
