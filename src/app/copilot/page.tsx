import { AppShell } from "@/components/app-shell";
import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { getCrmPageContext } from "@/lib/page-context";

export default async function CopilotPage() {
  const { supabase, profile, data } = await getCrmPageContext();
  const { data: copilotMessages } = await supabase
    .from("copilot_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(20);

  return (
    <AppShell profile={profile} title="Agent Copilot" eyebrow="AI assistant" activeHref="/copilot">
      <div className="mx-auto max-w-[1100px]">
        <CopilotPanel initialMessages={copilotMessages ?? []} merchants={data.merchants} />
      </div>
    </AppShell>
  );
}
