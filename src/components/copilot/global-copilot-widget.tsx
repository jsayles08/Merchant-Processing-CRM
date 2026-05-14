"use client";

import { useState } from "react";
import { Bot, ChevronDown, MessageCircle, Minus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

type WidgetMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const initialMessages: WidgetMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "I can help summarize accounts, draft follow-ups, and point you to the right CRM workflow.",
  },
];

export function GlobalCopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: WidgetMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, merchantId: null }),
      });
      const payload = (await response.json().catch(() => ({}))) as { content?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Copilot is available after sign in.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.content ?? "I processed that request.",
        },
      ]);
    } catch (error) {
      // TODO: Connect anonymous website visitors to a dedicated support AI route when public chat is enabled.
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "I could not reach the live Copilot route. Try opening the full Copilot page after signing in.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label="Open MerchantDesk Copilot"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0B0F15] text-white shadow-[0_18px_40px_rgba(11,15,21,0.28)] transition-all duration-200 hover:-translate-y-1 hover:bg-[#25425E] active:translate-y-0"
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-[390px] overflow-hidden rounded-[28px] border border-white/80 bg-[#FDFDFD]/90 shadow-[0_24px_70px_rgba(11,15,21,0.22)] backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-[#ABB7C0]/25 p-3">
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 text-left"
          onClick={() => setIsMinimized((current) => !current)}
          aria-expanded={!isMinimized}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0E5EC9] text-white">
            <Bot className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-[#0B0F15]">MerchantDesk Copilot</span>
            <span className="block truncate text-xs font-semibold text-[#25425E]/65">
              {isLoading ? "Thinking..." : "Always available"}
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 text-[#25425E] transition ${isMinimized ? "" : "rotate-180"}`} />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Minimize Copilot"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#25425E] hover:bg-white"
            onClick={() => setIsMinimized(true)}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Close Copilot"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#25425E] hover:bg-white"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized ? (
        <div className="space-y-3 p-3">
          <div className="h-80 space-y-3 overflow-y-auto rounded-[22px] border border-[#ABB7C0]/25 bg-white/58 p-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-[20px] px-3 py-2 text-sm leading-6 ${
                    message.role === "user" ? "bg-[#0E5EC9] text-white" : "bg-[#F8F8F9] text-[#25425E]"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading ? <p className="text-sm font-semibold text-[#25425E]/65">Copilot is typing...</p> : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Textarea
              className="min-h-16"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  void sendMessage();
                }
              }}
              placeholder="Ask about pipeline, tasks, documents..."
            />
            <Button className="min-h-12 sm:h-auto" type="button" disabled={isLoading} onClick={sendMessage}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
