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
  suggestions: string[];
};

export const copilotModel = process.env.OPENAI_MODEL ?? "gpt-5.4";

const actionCatalog = [
  "create_merchant",
  "update_stage",
  "add_merchant_update",
  "update_merchant_profile",
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
    "You help agents, managers, and admins operate the CRM, coach sales work, prepare underwriting handoffs, recruit agents, manage residuals, and turn plain English into confirmed CRM actions.",
    "Be closer to a strong ChatGPT operator than a rules bot: infer intent, use context, explain tradeoffs briefly, and propose the smallest useful next action.",
    "Use company memory when available. Learn durable company facts, preferred processes, sales language, approval rules, processor notes, onboarding practices, risk rules, and playbooks.",
    "Do not memorize secrets, private keys, full card data, bank account data, passwords, or one-time credentials. If the user provides those, warn them and do not add them to memory.",
    "Major CRM writes must be returned as actions with requires_confirmation=true. Never claim a write happened until the user confirms the action.",
    "For vague asks, answer usefully first, then ask one clarifying question only if the CRM task cannot be completed safely without it.",
    "Do not reply with generic phrases like 'I parsed the update' unless you also provide specific CRM observations and next steps.",
    "Prefer concrete next steps, missing-field checks, risk/underwriting notes, and short operational language. Be professional, direct, and useful.",
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
  const staleMerchants = buildStaleMerchantSignals(data);

  return JSON.stringify(
    {
      today: new Date().toISOString(),
      company: {
        product: brand.productName,
        companyName: brand.companyName,
        supportEmail: brand.supportEmail,
      },
      selectedMerchant: selectedMerchant ? summarizeMerchant(selectedMerchant, data.tasks) : null,
      portfolioSignals: {
        openTaskCount: data.tasks.filter((task) => task.status !== "completed").length,
        pendingPricingApprovals: data.deals.filter((deal) => deal.approval_status === "pending").length,
        unsignedSignatureRequests: data.signatureRequests.filter((request) => !["signed", "declined", "expired"].includes(request.status)).length,
        staleMerchants,
      },
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
      suggestions: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["content", "actions", "memories", "suggestions"],
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

export function buildStructuredFallback(
  input:
    | string
    | {
        message: string;
        merchantId?: string | null;
        data?: Pick<CrmData, "deals" | "documents" | "merchantUpdates" | "merchants" | "tasks" | "signatureRequests">;
        selectedMerchant?: Merchant | null;
      },
  merchantId?: string | null,
): CopilotStructuredResponse {
  const params = typeof input === "string" ? { message: input, merchantId } : input;
  const message = params.message.trim();
  const lower = message.toLowerCase();
  const matchedMerchant = params.selectedMerchant ?? findMerchantByMessage(params.data?.merchants ?? [], message);
  const merchantPayload = matchedMerchant ? { merchant_id: matchedMerchant.id } : params.merchantId ? { merchant_id: params.merchantId } : {};
  const merchantName = matchedMerchant?.business_name ?? extractFallbackMerchantName(message);
  const learnedMemory = maybeBuildMemory(message);
  const volume = extractMoneyAmount(message);
  const dueDate = inferDueDate(lower);

  if (isSmallTalk(lower)) {
    return {
      content:
        "Hey. I am ready to help with pipeline follow-ups, merchant notes, underwriting prep, task creation, recruiting, documents, and commission questions. Give me a messy update or ask what needs attention today.",
      actions: [],
      memories: learnedMemory ? [learnedMemory] : [],
      suggestions: [
        "Which merchants need attention today?",
        "Draft a follow-up for my hottest opportunity",
        "Create a task from this call note",
      ],
    };
  }

  if (params.data && /\b(which|what|show|list|prioritize|prioritise|who)\b/i.test(lower) && /\b(follow\s?ups?|today|overdue|next best|attention|priorit)/i.test(lower)) {
    const recommendations = buildFollowUpRecommendations(params.data);
    return {
      content: recommendations.length
        ? `Here are the best follow-ups to work now:\n\n${recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\nI can turn any of these into tasks or draft the outreach.`
        : "I do not see any obvious overdue follow-ups in the current CRM snapshot. A good next move is to review qualified or underwriting merchants for missing statements, owner details, and pricing approvals.",
      actions: [
        {
          action_type: "next_best_action",
          action_summary: "Prioritize the next merchant follow-ups from open tasks and stale pipeline activity.",
          requires_confirmation: false,
          payload: { recommendations },
        },
      ],
      memories: learnedMemory ? [learnedMemory] : [],
      suggestions: ["Create tasks for the top follow-ups", "Draft outreach for the first merchant", "Show underwriting blockers"],
    };
  }

  if (lower.includes("follow") || lower.includes("tomorrow") || lower.includes("friday")) {
    const actions: CopilotActionDraft[] = [
      {
        action_type: "create_task",
        action_summary: `Create a high-priority follow-up task${matchedMerchant ? ` for ${matchedMerchant.business_name}` : ""}.`,
        requires_confirmation: true,
        payload: {
          title: matchedMerchant ? `Follow up with ${matchedMerchant.business_name}` : "Follow up with merchant",
          description: message,
          priority: "high",
          due_date: dueDate,
          ...merchantPayload,
        },
      },
    ];

    if (matchedMerchant) {
      actions.push({
        action_type: "add_merchant_update",
        action_summary: `Add this note to ${matchedMerchant.business_name}'s timeline.`,
        requires_confirmation: true,
        payload: { update_type: "call", note: message, next_follow_up_date: dueDate, ...merchantPayload },
      });
    } else if (merchantName !== "New Merchant Lead") {
      actions.push({
        action_type: "create_merchant",
        action_summary: `Create ${merchantName} as a merchant lead.`,
        requires_confirmation: true,
        payload: { source_text: message, status: "lead", business_name: merchantName, monthly_volume_estimate: volume },
      });
    }

    if (matchedMerchant && volume > 0 && volume !== matchedMerchant.monthly_volume_estimate) {
      actions.push({
        action_type: "update_merchant_profile",
        action_summary: `Update ${matchedMerchant.business_name}'s estimated monthly volume to ${formatMoney(volume)}.`,
        requires_confirmation: true,
        payload: { monthly_volume_estimate: volume, ...merchantPayload },
      });
    }

    return {
      content:
        matchedMerchant
          ? `I matched this to ${matchedMerchant.business_name}. I prepared a follow-up task, a timeline note, and ${volume > 0 ? `captured the ${formatMoney(volume)}/month volume signal` : "will keep underwriting blockers visible"}. Before underwriting, make sure statements, owner verification, average ticket, and current processor details are complete.`
          : `I did not find a confident existing merchant match. I can still create the follow-up task${merchantName !== "New Merchant Lead" ? ` and a new lead for ${merchantName}` : ""}, but I would confirm the business name, contact email, phone, processor, volume, and average ticket.`,
      actions,
      memories: learnedMemory ? [learnedMemory] : [],
      suggestions: ["Draft the follow-up email", "Show missing underwriting fields", "Create onboarding from this lead"],
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
            business_name: merchantName,
            monthly_volume_estimate: volume,
          },
        },
      ],
      memories: learnedMemory ? [learnedMemory] : [],
      suggestions: ["Create a follow-up task", "Start merchant onboarding", "Request statements and owner ID"],
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
      suggestions: ["Show underwriting checklist", "Create a signature request", "Draft missing-documents email"],
    };
  }

  return {
    content:
      "I can help with that. I did not see enough detail for a safe CRM write yet, but I can summarize the account, find missing fields, create a task, draft outreach, or save durable company knowledge if this is a policy or process note.",
    actions: [
      {
        action_type: "next_best_action",
        action_summary: "Identify missing fields and recommend the next smallest deal-moving action.",
        requires_confirmation: false,
        payload: null,
      },
    ],
    memories: learnedMemory ? [learnedMemory] : [],
    suggestions: ["Find missing fields", "Create a follow-up task", "Remember this as company process"],
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

function buildStaleMerchantSignals(
  data: Pick<CrmData, "deals" | "merchantUpdates" | "merchants" | "tasks" | "signatureRequests">,
) {
  const fourteenDaysAgo = Date.now() - 14 * 86_400_000;
  return data.merchants
    .filter((merchant) => !["processing", "lost", "inactive"].includes(merchant.status))
    .map((merchant) => {
      const latestUpdate = data.merchantUpdates
        .filter((update) => update.merchant_id === merchant.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const openTasks = data.tasks.filter((task) => task.merchant_id === merchant.id && task.status !== "completed");
      const unsignedDocuments = data.signatureRequests.filter(
        (request) => request.related_entity_id === merchant.id && !["signed", "declined", "expired"].includes(request.status),
      );
      const lastTouchedAt = latestUpdate?.created_at ?? merchant.updated_at ?? merchant.created_at;
      return {
        merchant_id: merchant.id,
        business_name: merchant.business_name,
        status: merchant.status,
        open_tasks: openTasks.length,
        unsigned_signature_requests: unsignedDocuments.length,
        last_touched_at: lastTouchedAt,
        stale: new Date(lastTouchedAt).getTime() < fourteenDaysAgo,
      };
    })
    .filter((signal) => signal.open_tasks || signal.unsigned_signature_requests || signal.stale)
    .slice(0, 10);
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

function isSmallTalk(lowerMessage: string) {
  return /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)[.!?\s]*$/i.test(lowerMessage);
}

function buildFollowUpRecommendations(
  data: Pick<CrmData, "deals" | "merchantUpdates" | "merchants" | "tasks" | "signatureRequests">,
) {
  const now = Date.now();
  const recommendations = data.tasks
    .filter((task) => task.status !== "completed")
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 4)
    .map((task) => {
      const merchant = task.merchant_id ? data.merchants.find((item) => item.id === task.merchant_id) : null;
      const due = new Date(task.due_date);
      const dueLabel = due.getTime() < now ? "overdue" : `due ${due.toLocaleDateString()}`;
      return `${merchant?.business_name ?? "General task"}: ${task.title} (${dueLabel}, ${task.priority} priority)`;
    });

  if (recommendations.length >= 4) return recommendations;

  const staleSignals = buildStaleMerchantSignals(data)
    .filter((signal) => signal.stale)
    .slice(0, 4 - recommendations.length)
    .map((signal) => `${signal.business_name}: no recent activity since ${new Date(signal.last_touched_at).toLocaleDateString()} while in ${signal.status}.`);

  return [...recommendations, ...staleSignals].slice(0, 4);
}

function findMerchantByMessage(merchants: Merchant[], message: string) {
  const normalizedMessage = normalizeForMatch(message);
  return merchants.find((merchant) => {
    const businessWords = normalizeForMatch(merchant.business_name).split(" ").filter((word) => word.length > 2);
    const contactWords = normalizeForMatch(merchant.contact_name).split(" ").filter((word) => word.length > 2);
    const businessMatch =
      businessWords.length > 0 &&
      (normalizedMessage.includes(businessWords.join(" ")) || businessWords.slice(0, 2).every((word) => normalizedMessage.includes(word)));
    const contactMatch = contactWords.length > 0 && contactWords.some((word) => normalizedMessage.includes(word));
    return businessMatch || (contactMatch && businessWords.some((word) => normalizedMessage.includes(word)));
  }) ?? null;
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function extractFallbackMerchantName(message: string) {
  const calledMatch = message.match(/called\s+([^.,]+?)(?:\s+contact|\s+wants|\.|,|$)/i);
  const merchantMatch = message.match(/merchant\s+(?:called|named)?\s*([^.,]+?)(?:\s+contact|\s+wants|\.|,|$)/i);
  return (calledMatch?.[1] || merchantMatch?.[1] || "New Merchant Lead").trim();
}
