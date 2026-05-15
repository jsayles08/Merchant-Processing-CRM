"use client";

import { useState } from "react";
import { Bot, BrainCircuit, CheckCircle2, Lightbulb, Send, Sparkles, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/field";
import type { CopilotAction, CopilotMessage, Merchant } from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: CopilotAction[];
};

const examples = [
  "Add a new merchant called Buffalo Auto Detail. Contact is Sarah. She wants a quote.",
  "Move ABC Grocery to underwriting.",
  "Which merchants should I follow up with today?",
  "Remember: our underwriting handoff requires 3 months of statements and owner contact verification.",
  "Create a recruit lead for Jordan Lee from LinkedIn and remind me tomorrow.",
];

export function CopilotPanel({
  initialMessages,
  merchants,
  initialMerchantId = "",
}: {
  initialMessages: CopilotMessage[];
  merchants: Merchant[];
  initialMerchantId?: string;
}) {
  const [input, setInput] = useState("I spoke to Mike at Joe's Pizza. He wants a follow-up Friday and currently processes about $45k/month.");
  const [selectedMerchantId, setSelectedMerchantId] = useState(
    merchants.some((merchant) => merchant.id === initialMerchantId) ? initialMerchantId : "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length
      ? initialMessages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            id: message.id,
            role: message.role as "user" | "assistant",
            content: message.content,
          }))
      : [
          {
            id: "assistant-welcome",
            role: "assistant",
            content:
              "I can turn agent notes into structured CRM actions, flag missing merchant details, draft follow-ups, and summarize pipeline risk. Major writes require confirmation before they hit Supabase.",
          },
        ],
  );
  const [statusMessage, setStatusMessage] = useState("");

  async function submitPrompt() {
    if (!input.trim()) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: input.trim() };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content, merchantId: selectedMerchantId || null }),
      });
      const payload = (await response.json()) as {
        id?: string;
        content?: string;
        actions?: CopilotAction[];
        memoriesCreated?: number;
        message?: string;
        model?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Copilot request failed.");
      }

      setMessages((current) => [
        ...current,
        {
          id: payload.id ?? crypto.randomUUID(),
          role: "assistant",
          content:
            payload.content ??
            `I processed the request with ${payload.model ?? "Copilot"}, but no response content was returned.`,
          actions: payload.actions,
        },
      ]);
      if (payload.memoriesCreated) {
        setStatusMessage(`Copilot learned ${payload.memoriesCreated} reusable company ${payload.memoriesCreated === 1 ? "memory" : "memories"}.`);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            error instanceof Error
              ? `Copilot could not finish that request: ${error.message}`
              : "I could not reach the Copilot route. Suggested fallback: create a follow-up task, append the note to the merchant timeline, and ask for statement volume before pricing.",
          actions: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmAction(actionId: string) {
    const response = await fetch(`/api/copilot/actions/${actionId}/confirm`, { method: "POST" });
    const payload = (await response.json()) as { ok: boolean; message: string; status?: CopilotAction["status"] };
    setStatusMessage(payload.message);

    if (!response.ok) {
      return;
    }

    if (payload.ok) {
      setMessages((current) =>
        current.map((message) => ({
          ...message,
          actions: message.actions?.map((action) =>
            action.id === actionId ? { ...action, status: payload.status ?? "completed" } : action,
          ),
        })),
      );
    }
  }

  return (
    <section id="agent-copilot" className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
      <Card>
        <CardHeader>
          <CardTitle>Agent Copilot</CardTitle>
          <CardDescription>Plain English CRM updates with structured action suggestions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="crm-panel rounded-[24px] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0E5EC9]">
              <Sparkles className="h-4 w-4" />
              GPT-5.4 intelligence layer
            </div>
            <p className="mt-2 text-sm leading-6 text-[#25425E]">
              Copilot uses CRM context, retained company memory, and confirmation-first actions so it can learn your operating style without silently changing records.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs font-black text-[#25425E]">
              <BrainCircuit className="h-3.5 w-3.5 text-[#0E5EC9]" />
              Memory-aware
            </div>
          </div>
          <div className="space-y-2">
            {examples.map((example) => (
              <button
                key={example}
                onClick={() => setInput(example)}
                className="crm-panel w-full rounded-[20px] p-3 text-left text-sm text-[#25425E] transition hover:bg-white/70 hover:text-[#0B0F15]"
              >
                {example}
              </button>
            ))}
          </div>
          <Select value={selectedMerchantId} onChange={(event) => setSelectedMerchantId(event.target.value)}>
            <option value="">No merchant selected</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.business_name}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Copilot Workspace</CardTitle>
              <CardDescription>Review extracted actions before committing material updates.</CardDescription>
            </div>
            <Badge tone="blue">Confirmation-first</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="crm-panel h-[420px] space-y-4 overflow-y-auto rounded-[24px] p-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" ? <Avatar icon={<Bot className="h-4 w-4" />} /> : null}
                <div className={`max-w-[82%] rounded-[22px] border p-3 text-sm leading-6 ${message.role === "user" ? "border-[#0E5EC9]/20 bg-[#0E5EC9] text-white" : "border-[#ABB7C0]/25 bg-white text-[#25425E]"}`}>
                  {message.content}
                  {message.actions?.length ? (
                    <div className="mt-3 space-y-2">
                      {message.actions.map((action) => (
                        <div key={action.id} className="flex items-center justify-between gap-2 rounded-2xl border border-[#ABB7C0]/25 bg-[#FDFDFD] px-2 py-1.5 text-xs text-[#25425E]">
                          <span className="flex min-w-0 items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#0E5EC9]" />
                            <span className="truncate">{action.action_summary}</span>
                          </span>
                          {action.status === "requires_confirmation" ? (
                            <button
                              className="shrink-0 rounded-full bg-[#0B0F15] px-2 py-1 font-semibold text-white"
                              onClick={() => void confirmAction(action.id)}
                            >
                              Confirm
                            </button>
                          ) : (
                            <Badge tone={action.status === "completed" ? "blue" : "slate"}>{action.status}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                {message.role === "user" ? <Avatar icon={<UserRound className="h-4 w-4" />} /> : null}
              </div>
            ))}
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Lightbulb className="h-4 w-4 animate-pulse text-[#D57D25]" />
                Copilot is structuring the update...
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Textarea
              id="copilot-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  void submitPrompt();
                }
              }}
              placeholder="Type a merchant update, task, pipeline request, or coaching question..."
            />
            <Button className="h-auto min-h-12 sm:w-28" onClick={submitPrompt} disabled={isLoading}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
          {statusMessage ? (
            <p className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">
              {statusMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function Avatar({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[#ABB7C0]/25 bg-white text-[#25425E]">
      {icon}
    </div>
  );
}
