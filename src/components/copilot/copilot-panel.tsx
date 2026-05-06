"use client";

import { useState } from "react";
import { Bot, CheckCircle2, Lightbulb, Send, Sparkles, UserRound } from "lucide-react";
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
  "Estimate my monthly residual if these 3 deals close.",
];

export function CopilotPanel({
  initialMessages,
  merchants,
}: {
  initialMessages: CopilotMessage[];
  merchants: Merchant[];
}) {
  const [input, setInput] = useState("I spoke to Mike at Joe's Pizza. He wants a follow-up Friday and currently processes about $45k/month.");
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
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
      const payload = (await response.json()) as { id?: string; content: string; actions?: CopilotAction[] };

      setMessages((current) => [
        ...current,
        {
          id: payload.id ?? crypto.randomUUID(),
          role: "assistant",
          content: payload.content,
          actions: payload.actions,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I could not reach the Copilot route. Suggested fallback: create a follow-up task, append the note to the merchant timeline, and ask for statement volume before pricing.",
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
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              <Sparkles className="h-4 w-4" />
              OpenAI route included
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
              Messages and suggested actions persist in Supabase. Major writes stay pending until you confirm them.
            </p>
          </div>
          <div className="space-y-2">
            {examples.map((example) => (
              <button
                key={example}
                onClick={() => setInput(example)}
                className="w-full rounded-md border border-slate-200 bg-white p-3 text-left text-sm text-slate-600 transition hover:border-emerald-300 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-emerald-800"
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
          <div className="h-[420px] space-y-4 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" ? <Avatar icon={<Bot className="h-4 w-4" />} /> : null}
                <div className={`max-w-[82%] rounded-lg border p-3 text-sm leading-6 ${message.role === "user" ? "border-emerald-200 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"}`}>
                  {message.content}
                  {message.actions?.length ? (
                    <div className="mt-3 space-y-2">
                      {message.actions.map((action) => (
                        <div key={action.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                          <span className="flex min-w-0 items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span className="truncate">{action.action_summary}</span>
                          </span>
                          {action.status === "requires_confirmation" ? (
                            <button
                              className="shrink-0 rounded bg-emerald-600 px-2 py-1 font-medium text-white"
                              onClick={() => void confirmAction(action.id)}
                            >
                              Confirm
                            </button>
                          ) : (
                            <Badge tone={action.status === "completed" ? "emerald" : "slate"}>{action.status}</Badge>
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
                <Lightbulb className="h-4 w-4 animate-pulse text-emerald-600" />
                Copilot is structuring the update...
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Textarea
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
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
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
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      {icon}
    </div>
  );
}
