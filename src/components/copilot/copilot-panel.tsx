"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Loader2,
  Send,
  Sparkles,
  UserRound,
  XCircle,
  Zap,
} from "lucide-react";
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
  suggestions?: string[];
};

const examples = [
  {
    label: "Prioritize today",
    prompt: "Which merchants should I follow up with today, and why?",
  },
  {
    label: "Log a messy call",
    prompt: "I spoke to Mike at Joe's Pizza. He wants a follow-up Friday and currently processes about $45k/month.",
  },
  {
    label: "Underwriting prep",
    prompt: "Check Joe's Pizza for underwriting readiness and tell me what is missing.",
  },
  {
    label: "Save process memory",
    prompt: "Remember: our underwriting handoff requires 3 months of statements and owner contact verification.",
  },
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
  const [input, setInput] = useState("");
  const [selectedMerchantId, setSelectedMerchantId] = useState(
    merchants.some((merchant) => merchant.id === initialMerchantId) ? initialMerchantId : "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const recentHistoryCount = initialMessages.filter((message) => message.role === "user" || message.role === "assistant").length;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "I can reason across your merchant book, tasks, onboarding records, documents, recruiting pipeline, residuals, and company memory. Tell me what happened in plain English and I will draft the safest CRM actions for confirmation.",
      suggestions: examples.map((example) => example.prompt),
    },
  ]);
  const [statusMessage, setStatusMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const selectedMerchant = merchants.find((merchant) => merchant.id === selectedMerchantId) ?? null;
  const activeSuggestions = useMemo(() => {
    const latest = [...messages].reverse().find((message) => message.role === "assistant" && message.suggestions?.length);
    return latest?.suggestions?.slice(0, 4) ?? examples.map((example) => example.prompt);
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  async function submitPrompt(promptOverride?: string) {
    const content = (promptOverride ?? input).trim();
    if (!content || isLoading) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setStatusMessage("");
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
        suggestions?: string[];
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
          suggestions: payload.suggestions,
        },
      ]);
      if (payload.memoriesCreated) {
        setStatusMessage(`Learned ${payload.memoriesCreated} reusable company ${payload.memoriesCreated === 1 ? "memory" : "memories"}.`);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            error instanceof Error
              ? `I could not finish that request: ${error.message}. Try again, or ask me to create a task/note from the same update.`
              : "I could not reach the live Copilot route. Try again, or open the merchant directly and add the note there.",
          actions: [],
          suggestions: ["Retry the request", "Create a task instead", "Open merchant onboarding"],
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

    if (!response.ok || !payload.ok) return;

    setMessages((current) =>
      current.map((message) => ({
        ...message,
        actions: message.actions?.map((action) =>
          action.id === actionId ? { ...action, status: payload.status ?? "completed" } : action,
        ),
      })),
    );
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Done. ${payload.message}`,
        suggestions: ["What should I do next?", "Show related tasks", "Check underwriting blockers"],
      },
    ]);
  }

  async function dismissAction(actionId: string) {
    const response = await fetch(`/api/copilot/actions/${actionId}/dismiss`, { method: "POST" });
    const payload = (await response.json()) as { ok: boolean; message: string; status?: CopilotAction["status"] };
    setStatusMessage(payload.message);

    if (!response.ok || !payload.ok) return;

    setMessages((current) =>
      current.map((message) => ({
        ...message,
        actions: message.actions?.map((action) =>
          action.id === actionId ? { ...action, status: payload.status ?? "dismissed" } : action,
        ),
      })),
    );
  }

  return (
    <section id="agent-copilot" className="grid min-h-[calc(100vh-13rem)] gap-6 xl:grid-cols-[24rem_1fr]">
      <Card className="xl:sticky xl:top-28 xl:h-[calc(100vh-9rem)] xl:overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B0F15] text-white">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Copilot Command Center</CardTitle>
              <CardDescription>CRM-aware assistant with confirmation-first execution.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="crm-panel rounded-[24px] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0E5EC9]">
              <Sparkles className="h-4 w-4" />
              GPT intelligence + CRM memory
            </div>
            <p className="mt-2 text-sm leading-6 text-[#25425E]">
              Copilot can draft notes, create tasks, update merchant fields, prepare underwriting, start onboarding, save company process memory, and explain what it needs before changing records.
            </p>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-black uppercase tracking-wide text-[#25425E]/70">Context</p>
            <Select value={selectedMerchantId} onChange={(event) => setSelectedMerchantId(event.target.value)}>
              <option value="">Use entire CRM context</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.business_name}
                </option>
              ))}
            </Select>
            {selectedMerchant ? (
              <div className="crm-panel rounded-[22px] p-3 text-sm text-[#25425E]">
                <p className="font-black text-[#0B0F15]">{selectedMerchant.business_name}</p>
                <p className="mt-1">{selectedMerchant.contact_name} · {selectedMerchant.status.replaceAll("_", " ")}</p>
                <p className="mt-1">{formatCurrency(selectedMerchant.monthly_volume_estimate)}/mo · {selectedMerchant.current_processor || "Processor unknown"}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wide text-[#25425E]/70">Fast prompts</p>
            {examples.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => void submitPrompt(example.prompt)}
                disabled={isLoading}
                className="crm-panel w-full rounded-[20px] p-3 text-left transition hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="block text-sm font-black text-[#0B0F15]">{example.label}</span>
                <span className="mt-1 block text-sm leading-5 text-[#25425E]/75">{example.prompt}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InsightPill icon={<ClipboardCheck className="h-4 w-4" />} label="Actions" value="Confirm-first" />
            <InsightPill icon={<Zap className="h-4 w-4" />} label="History" value={`${recentHistoryCount} synced`} />
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-[calc(100vh-13rem)] flex-col overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Copilot Workspace</CardTitle>
              <CardDescription>Natural language in. Reviewed CRM execution out.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">CRM context</Badge>
              <Badge tone="amber">Underwriting-aware</Badge>
              <Badge tone="slate">No silent writes</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="crm-panel min-h-[26rem] flex-1 overflow-y-auto rounded-[24px] p-4" aria-live="polite">
            <div className="space-y-5">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onConfirm={confirmAction}
                  onDismiss={dismissAction}
                />
              ))}
              {isLoading ? (
                <div className="flex items-center gap-3 text-sm font-semibold text-[#25425E]/70">
                  <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white text-[#0E5EC9] ring-1 ring-[#ABB7C0]/25">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                  Reading CRM context, planning safe actions, and checking what needs confirmation...
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </div>

          {activeSuggestions.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {activeSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void submitPrompt(suggestion)}
                  disabled={isLoading}
                  className="shrink-0 rounded-full border border-[#ABB7C0]/35 bg-white/65 px-3 py-2 text-sm font-semibold text-[#25425E] transition hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <div className="rounded-[28px] border border-[#ABB7C0]/30 bg-white/70 p-2 shadow-inner">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Textarea
                id="copilot-input"
                className="min-h-20 resize-none border-0 bg-transparent shadow-none focus:translate-y-0 focus:border-transparent focus:ring-0"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitPrompt();
                  }
                }}
                placeholder="Ask Copilot to summarize, create a task, update a merchant, prepare underwriting, draft outreach, or remember a company process..."
              />
              <Button className="min-h-12 self-end sm:w-28" onClick={() => void submitPrompt()} disabled={isLoading || !input.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>

          {statusMessage ? (
            <p className="crm-panel rounded-2xl p-3 text-sm font-semibold text-[#25425E]">
              {statusMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function ChatMessage({
  message,
  onConfirm,
  onDismiss,
}: {
  message: Message;
  onConfirm: (actionId: string) => Promise<void>;
  onDismiss: (actionId: string) => Promise<void>;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? <Avatar icon={<Bot className="h-4 w-4" />} /> : null}
      <div className={`max-w-[88%] space-y-3 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`whitespace-pre-line rounded-[24px] border px-4 py-3 text-sm leading-6 shadow-sm ${
            isUser
              ? "border-[#0E5EC9]/20 bg-[#0E5EC9] text-white"
              : "border-[#ABB7C0]/25 bg-white text-[#25425E]"
          }`}
        >
          {message.content}
        </div>
        {message.actions?.length ? (
          <div className="grid gap-2">
            {message.actions.map((action) => (
              <ActionCard key={action.id} action={action} onConfirm={onConfirm} onDismiss={onDismiss} />
            ))}
          </div>
        ) : null}
      </div>
      {isUser ? <Avatar icon={<UserRound className="h-4 w-4" />} /> : null}
    </div>
  );
}

function ActionCard({
  action,
  onConfirm,
  onDismiss,
}: {
  action: CopilotAction;
  onConfirm: (actionId: string) => Promise<void>;
  onDismiss: (actionId: string) => Promise<void>;
}) {
  const details = describePayload(action.payload);
  const closed = ["completed", "dismissed", "failed", "confirmed"].includes(action.status);

  return (
    <div className="rounded-[22px] border border-[#ABB7C0]/30 bg-[#FDFDFD]/92 p-3 text-sm shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(action.status)}>{action.status.replaceAll("_", " ")}</Badge>
            <span className="text-xs font-black uppercase tracking-wide text-[#25425E]/55">{action.action_type.replaceAll("_", " ")}</span>
          </div>
          <p className="mt-2 font-semibold leading-5 text-[#0B0F15]">{action.action_summary}</p>
          {details.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {details.map((detail) => (
                <span key={detail} className="rounded-full bg-[#25425E]/7 px-2.5 py-1 text-xs font-semibold text-[#25425E]">
                  {detail}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {!closed ? (
          <div className="flex shrink-0 gap-2">
            {action.status === "requires_confirmation" ? (
              <Button size="sm" type="button" onClick={() => void onConfirm(action.id)}>
                <CheckCircle2 className="h-4 w-4" />
                Confirm
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" type="button" onClick={() => void onDismiss(action.id)}>
              <XCircle className="h-4 w-4" />
              Dismiss
            </Button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase text-[#25425E]/65">
            {action.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-[#0E5EC9]" /> : <CircleDashed className="h-4 w-4" />}
            {action.status}
          </span>
        )}
      </div>
    </div>
  );
}

function Avatar({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[#ABB7C0]/25 bg-white text-[#25425E]">
      {icon}
    </div>
  );
}

function InsightPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="crm-panel rounded-[20px] p-3">
      <div className="flex items-center gap-2 text-[#0E5EC9]">{icon}<span className="text-xs font-black uppercase text-[#25425E]/60">{label}</span></div>
      <p className="mt-1 text-sm font-black text-[#0B0F15]">{value}</p>
    </div>
  );
}

function describePayload(payload: Record<string, unknown> | null) {
  if (!payload) return [];
  return Object.entries(payload)
    .filter(([key, value]) => value !== null && value !== undefined && !["source_text", "note", "description"].includes(key))
    .slice(0, 5)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${formatPayloadValue(value)}`);
}

function formatPayloadValue(value: unknown) {
  if (typeof value === "number") return value >= 1000 ? formatCurrency(value) : value.toString();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()) && value.includes("T")) return date.toLocaleDateString();
    return value.length > 36 ? `${value.slice(0, 33)}...` : value;
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  return "set";
}

function statusTone(status: CopilotAction["status"]) {
  if (status === "completed" || status === "confirmed") return "blue";
  if (status === "requires_confirmation") return "amber";
  if (status === "failed" || status === "dismissed") return "rose";
  return "slate";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
