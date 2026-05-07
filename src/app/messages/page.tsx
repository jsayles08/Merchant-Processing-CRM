import { AppShell } from "@/components/app-shell";
import { MessageCenter } from "@/components/messages/message-center";
import { getCrmPageContext } from "@/lib/page-context";
import type { CopilotMessage } from "@/lib/types";

export default async function MessagesPage() {
  const { supabase, profile, data } = await getCrmPageContext();
  const { data: messages } = await supabase
    .from("copilot_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<CopilotMessage[]>();

  return (
    <AppShell profile={profile} title="Messages" eyebrow="Communication center" activeHref="/messages">
      <div className="w-full">
        <MessageCenter messages={messages ?? []} merchants={data.merchants} />
      </div>
    </AppShell>
  );
}
