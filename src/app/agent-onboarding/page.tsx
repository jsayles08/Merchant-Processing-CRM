import { AppShell } from "@/components/app-shell";
import { AgentOnboardingWorkspace } from "@/components/onboarding/agent-onboarding-workspace";
import { getCrmPageContext } from "@/lib/page-context";

export default async function AgentOnboardingPage() {
  const { profile, data } = await getCrmPageContext();

  return (
    <AppShell profile={profile} title="Agent Onboarding" eyebrow="Activation workflow" activeHref="/agent-onboarding">
      <AgentOnboardingWorkspace data={data} />
    </AppShell>
  );
}
