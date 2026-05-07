import Link from "next/link";
import type { ReactNode } from "react";
import { Bot, Clock3, ExternalLink, Mail, MessageSquareText, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CopilotMessage, Merchant } from "@/lib/types";

export function MessageCenter({
  messages,
  merchants,
}: {
  messages: CopilotMessage[];
  merchants: Merchant[];
}) {
  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const userMessages = messages.filter((message) => message.role === "user");
  const assistantMessages = messages.filter((message) => message.role === "assistant");

  return (
    <section id="messages" className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
      <Card>
        <CardHeader>
          <CardTitle>Message Hub</CardTitle>
          <CardDescription>Copilot conversations and merchant-linked message history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Summary icon={<MessageSquareText className="h-4 w-4" />} label="Agent messages" value={userMessages.length.toString()} />
          <Summary icon={<Bot className="h-4 w-4" />} label="Copilot replies" value={assistantMessages.length.toString()} />
          <Summary icon={<Clock3 className="h-4 w-4" />} label="Latest activity" value={messages[0] ? new Date(messages[0].created_at).toLocaleDateString() : "None"} />
          <Link
            href="/copilot"
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#0B0F15] px-4 text-sm font-semibold text-white shadow-sm shadow-[#0B0F15]/20 hover:bg-[#25425E]"
          >
            <Send className="h-4 w-4" />
            Open Agent Copilot
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Inbox</CardTitle>
              <CardDescription>Newest CRM messages first, linked back to the right merchant when available.</CardDescription>
            </div>
            <Badge tone="blue">{messages.length} messages</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!messages.length ? (
            <EmptyState
              icon={<Mail className="h-5 w-5" />}
              title="No messages yet"
              description="Send the first Copilot prompt or merchant update to start the message history."
              action={
                <Link href="/copilot" className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#0B0F15] px-4 text-sm font-semibold text-white">
                  <Send className="h-4 w-4" />
                  Start Conversation
                </Link>
              }
            />
          ) : null}

          {messages.map((message) => {
            const merchant = message.merchant_id ? merchantById.get(message.merchant_id) : null;
            return (
              <article key={message.id} className="crm-panel rounded-[24px] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={message.role === "assistant" ? "blue" : "slate"}>{message.role}</Badge>
                      {merchant ? <Badge tone="amber">{merchant.business_name}</Badge> : null}
                      <span className="text-xs font-medium text-[#25425E]/60">{new Date(message.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#25425E]">{message.content}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {merchant ? (
                      <Link
                        href={`/merchants/${merchant.id}`}
                        aria-label={`Open ${merchant.business_name}`}
                        title={`Open ${merchant.business_name}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ABB7C0]/30 bg-white/65 text-[#0B0F15]"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    ) : null}
                    <Link
                      href="/copilot"
                      aria-label="Reply in Copilot"
                      title="Reply in Copilot"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ABB7C0]/30 bg-white/65 text-[#0B0F15]"
                    >
                      <Send className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="crm-panel flex items-center justify-between gap-3 rounded-2xl p-3">
      <span className="flex items-center gap-2 text-sm font-medium text-[#25425E]/70">
        {icon}
        {label}
      </span>
      <span className="font-black text-[#0B0F15]">{value}</span>
    </div>
  );
}
