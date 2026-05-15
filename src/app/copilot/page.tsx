import { AppShell } from "@/components/app-shell";
import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { getCrmPageContext } from "@/lib/page-context";

export default async function CopilotPage({
  searchParams,
}: {
  searchParams?: Promise<{ merchant?: string }>;
}) {
  const { supabase, profile, data } = await getCrmPageContext("copilot.use");
  const params = await searchParams;
  const { data: copilotMessages } = await supabase
    .from("copilot_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(20);

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Agent Copilot" eyebrow="AI assistant" activeHref="/copilot">
      <div className="w-full">
        <CopilotPanel
          initialMessages={copilotMessages ?? []}
          merchants={data.merchants}
          initialMerchantId={params?.merchant ?? ""}
        />
      </div>
    </AppShell>
  );
}
