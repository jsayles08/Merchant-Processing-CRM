import type { CopilotMemory, CrmData, Merchant, MerchantStatus, Profile, Task } from "@/lib/types";
import { brand } from "@/lib/branding";

export type CopilotActionDraft = {
  action_type: string;
  action_summary: string;
  requires_confirmation: boolean;
  payload: Record<string, unknown> | null;
};

export type CopilotMemoryDraft = {
  scope: "company" | "merchant" | "agent" | "user";
  title: string;
  content: string;
  entity_id?: string | null;
  confidence?: number;
  source_type?: string;
  metadata?: Record<string, unknown> | null;
};

export type CopilotStructuredResponse = {
  content: string;
  actions: CopilotActionDraft[];
  memories: CopilotMemoryDraft[];
};

export const copilotModel = process.env.OPENAI_MODEL ?? "gpt-5.4";

const actionCatalog = [
  "create_merchant",
  "update_stage",
  "add_merchant_update",
  "create_task",
  "create_recruit",
  "create_merchant_onboarding",
  "create_signature_request",
  "pipeline_summary",
  "next_best_action",
  "knowledge_capture",
];

export function buildCopilotSystemPrompt(profile: Profile) {
  return [
    `You are ${brand.companyName} Copilot, an enterprise AI teammate for a merchant processing CRM.`,
    "You help agents, managers, and admins operate the CRM, coach sales work, prepare underwriting handoffs, and turn plain English into confirmed CRM actions.",
    "Use company memory when available. Learn durable company facts, preferred processes, sales language, approval rules, processor notes, onboarding practices, and playbooks.",
    "Do not memorize secrets, private keys, full card data, bank account data, passwords, or one-time credentials. If the user provides those, warn them and do not add them to memory.",
    "Major CRM writes must be returned as actions with requires_confirmation=true. Never claim a write happened until the user confirms the action.",
    "Prefer concrete next steps, missing-field checks, and short operational language. Be professional, direct, and useful.",
    `Current user: ${profile.full_name} (${profile.role}).`,
    `Supported action_type values: ${actionCatalog.join(", ")}.`,
  ].join("\n");
}

export function buildCopilotContext(params: {
  data: Pick<CrmData, "agents" | "deals" | "documents" | "merchantUpdates" | "merchants" | "profiles" | "tasks" | "agentRecruits" | "merchantOnboardingRecords" | "signatureRequests">;
  memories: CopilotMemory[];
  selectedMerchant?: Merchant | null;
  recentMessages: { role: string; content: string; created_at: string }[];
}) {
  const { data, memories, selectedMerchant, recentMessages } = params;
  const openTasks = data.tasks.filter((task) => task.status !== "completed").slice(0, 12);
  const activeDeals = data.deals.filter((deal) => !["processing", "lost", "inactive"].includes(deal.stage)).slice(0, 15);
  const recentUpdates = data.merchantUpdates.slice(0, 15);

  return JSON.stringify(
    {
      company: {
        product: brand.productName,
        companyName: brand.companyName,
        supportEmail: brand.supportEmail,
      },
      selectedMerchant: selectedMerchant ? summarizeMerchant(selectedMerchant, data.tasks) : null,
      pipeline: activeDeals.map((deal) => {
        const merchant = data.merchants.find((item) => item.id === deal.merchant_id);
        return {
          merchant_id: deal.merchant_id,
          business_name: merchant?.business_name ?? "Unknown merchant",
          stage: deal.stage,
          proposed_rate: deal.proposed_rate,
          volume: deal.estimated_monthly_volume,
          residual: deal.estimated_residual,
          approval_status: deal.approval_status,
          close_probability: deal.close_probability,
        };
      }),
      openTasks: openTasks.map(summarizeTask),
      recentMerchantUpdates: recentUpdates.map((update) => ({
        merchant_id: update.merchant_id,
        type: update.update_type,
        note: update.note,
        next_follow_up_date: update.next_follow_up_date,
        created_at: update.created_at,
      })),
      recruiting: data.agentRecruits.slice(0, 12).map((recruit) => ({
        id: recruit.id,
        full_name: recruit.full_name,
        status: recruit.status,
        source: recruit.source,
        follow_up_at: recruit.follow_up_at,
      })),
      merchantOnboarding: data.merchantOnboardingRecords.slice(0, 12).map((record) => ({
        id: record.id,
        business_name: record.business_name,
        status: record.status,
        assigned_agent_id: record.assigned_agent_id,
        follow_up_at: record.follow_up_at,
      })),
      signatureRequests: data.signatureRequests.slice(0, 12).map((request) => ({
        id: request.id,
        title: request.title,
        recipient_email: request.recipient_email,
        related_entity_type: request.related_entity_type,
        status: request.status,
      })),
      companyMemory: memories.slice(0, 40).map((memory) => ({
        scope: memory.scope,
        title: memory.title,
        content: memory.content,
        entity_id: memory.entity_id,
        confidence: memory.confidence,
        updated_at: memory.updated_at,
      })),
      recentConversation: recentMessages.slice(0, 12),
    },
    null,
    2,
  );
}

export function getCopilotJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      content: { type: "string" },
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            action_type: { type: "string", enum: actionCatalog },
            action_summary: { type: "string" },
            requires_confirmation: { type: "boolean" },
            payload: {
              anyOf: [
                { type: "object", additionalProperties: true },
                { type: "null" },
              ],
            },
          },
          required: ["action_type", "action_summary", "requires_confirmation", "payload"],
        },
      },
      memories: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            scope: { type: "string", enum: ["company", "merchant", "agent", "user"] },
            title: { type: "string" },
            content: { type: "string" },
            entity_id: { anyOf: [{ type: "string" }, { type: "null" }] },
            confidence: { type: "number" },
            source_type: { type: "string" },
            metadata: {
              anyOf: [
                { type: "object", additionalProperties: true },
                { type: "null" },
              ],
            },
          },
          required: ["scope", "title", "content", "entity_id", "confidence", "source_type", "metadata"],
        },
      },
    },
    required: ["content", "actions", "memories"],
  } as const;
}

export function sanitizeMemoryDrafts(memories: CopilotMemoryDraft[]) {
  return memories
    .filter((memory) => memory.title.trim() && memory.content.trim())
    .filter((memory) => !containsSensitiveSecret(memory.content))
    .slice(0, 6)
    .map((memory) => ({
      scope: memory.scope,
      title: memory.title.trim().slice(0, 140),
      content: memory.content.trim().slice(0, 1800),
      entity_id: isUuid(memory.entity_id) ? memory.entity_id : null,
      confidence: clampConfidence(memory.confidence),
      source_type: memory.source_type || "copilot_chat",
      metadata: memory.metadata ?? {},
    }));
}

export function buildStructuredFallback(message: string, merchantId?: string | null): CopilotStructuredResponse {
  const lower = message.toLowerCase();
  const merchantPayload = merchantId ? { merchant_id: merchantId } : {};
  const learnedMemory = maybeBuildMemory(message);

  if (lower.includes("follow") || lower.includes("tomorrow") || lower.includes("friday")) {
    return {
      content:
        "I found a follow-up intent. I can create the task, add the note to the merchant timeline, and flag missing statements or volume details before pricing.",
      actions: [
        {
          action_type: "create_task",
          action_summary: "Create a follow-up task from the requested timing.",
          requires_confirmation: true,
          payload: { title: "Follow up with merchant", priority: "high", due_date: inferDueDate(lower), ...merchantPayload },
        },
        {
          action_type: "add_merchant_update",
          action_summary: "Add the conversation note to the merchant timeline.",
          requires_confirmation: true,
          payload: { update_type: "call", note: message, ...merchantPayload },
        },
      ],
      memories: learnedMemory ? [learnedMemory] : [],
    };
  }

  if (lower.includes("new merchant") || lower.includes("called")) {
    return {
      content:
        "This looks like a merchant lead. I can create a lead record and set the next task, but I would still confirm contact email, phone, monthly volume, current processor, average ticket, and desired hardware before underwriting.",
      actions: [
        {
          action_type: "create_merchant",
          action_summary: "Create a new merchant lead and assign it to the current agent.",
          requires_confirmation: true,
          payload: {
            source_text: message,
            status: "lead",
            business_name: extractFallbackMerchantName(message),
            monthly_volume_estimate: extractMoneyAmount(message),
          },
        },
      ],
      memories: learnedMemory ? [learnedMemory] : [],
    };
  }

  if (lower.includes("underwriting") || lower.includes("move")) {
    return {
      content:
        "I can prepare a stage change. Before committing, verify the application package, statements, owner information, and pricing approval status.",
      actions: [
        {
          action_type: "update_stage",
          action_summary: "Move the matched merchant to underwriting after confirmation.",
          requires_confirmation: true,
          payload: { status: "underwriting", source_text: message, ...merchantPayload },
        },
      ],
      memories: learnedMemory ? [learnedMemory] : [],
    };
  }

  return {
    content:
      "I parsed the update and can turn it into a CRM note, detect missing fields, create a follow-up, or capture durable company knowledge for future answers.",
    actions: [
      {
        action_type: "next_best_action",
        action_summary: "Identify missing fields and recommend the next smallest deal-moving action.",
        requires_confirmation: false,
        payload: null,
      },
    ],
    memories: learnedMemory ? [learnedMemory] : [],
  };
}

export function isMerchantStatus(value: string): value is MerchantStatus {
  return [
    "lead",
    "contacted",
    "qualified",
    "application_sent",
    "underwriting",
    "approved",
    "onboarded",
    "processing",
    "inactive",
    "lost",
  ].includes(value);
}

function summarizeMerchant(merchant: Merchant, tasks: Task[]) {
  return {
    id: merchant.id,
    business_name: merchant.business_name,
    contact_name: merchant.contact_name,
    status: merchant.status,
    industry: merchant.industry,
    monthly_volume_estimate: merchant.monthly_volume_estimate,
    average_ticket: merchant.average_ticket,
    current_processor: merchant.current_processor,
    proposed_rate: merchant.proposed_rate,
    open_tasks: tasks.filter((task) => task.merchant_id === merchant.id && task.status !== "completed").map(summarizeTask),
  };
}

function summarizeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    due_date: task.due_date,
    priority: task.priority,
    status: task.status,
    merchant_id: task.merchant_id,
  };
}

function maybeBuildMemory(message: string): CopilotMemoryDraft | null {
  if (!/\b(remember|our process|we usually|company policy|playbook|rule|preferred|always|never)\b/i.test(message)) return null;
  if (containsSensitiveSecret(message)) return null;
  return {
    scope: "company",
    title: "User-shared operating note",
    content: message,
    confidence: 0.72,
    source_type: "copilot_chat",
    metadata: { capture: "fallback" },
  };
}

function containsSensitiveSecret(value: string) {
  return /\b(sk-[a-z0-9_-]{20,}|service_role|password|secret key|api key|routing number|account number|ssn|social security)\b/i.test(value);
}

function clampConfidence(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.7;
  return Math.min(Math.max(value, 0.1), 1);
}

function isUuid(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function inferDueDate(lowerMessage: string) {
  const now = new Date();
  if (lowerMessage.includes("tomorrow")) {
    return new Date(now.getTime() + 86_400_000).toISOString();
  }
  if (lowerMessage.includes("friday")) {
    const target = new Date(now);
    const day = target.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    target.setDate(target.getDate() + daysUntilFriday);
    return target.toISOString();
  }
  return new Date(now.getTime() + 86_400_000).toISOString();
}

function extractMoneyAmount(message: string) {
  const match = message.match(/\$?\s?(\d+(?:,\d{3})*(?:\.\d+)?)\s?(k|m)?(?:\/month| per month| monthly)?/i);
  if (!match) return 0;
  const base = Number(match[1].replaceAll(",", ""));
  if (Number.isNaN(base)) return 0;
  if (match[2]?.toLowerCase() === "m") return base * 1_000_000;
  if (match[2]?.toLowerCase() === "k") return base * 1_000;
  return base;
}

function extractFallbackMerchantName(message: string) {
  const calledMatch = message.match(/called\s+([^.,]+?)(?:\s+contact|\s+wants|\.|,|$)/i);
  const merchantMatch = message.match(/merchant\s+(?:called|named)?\s*([^.,]+?)(?:\s+contact|\s+wants|\.|,|$)/i);
  return (calledMatch?.[1] || merchantMatch?.[1] || "New Merchant Lead").trim();
}
