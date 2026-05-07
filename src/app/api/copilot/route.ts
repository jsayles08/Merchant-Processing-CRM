import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import { brand } from "@/lib/branding";
import { isOpenAIConfigured } from "@/lib/env";

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  merchantId: z.string().uuid().nullable().optional(),
});

const CopilotActionSchema = z.object({
  action_type: z.string(),
  action_summary: z.string(),
  requires_confirmation: z.boolean(),
  payload: z.record(z.string(), z.unknown()).nullable(),
});

type CopilotActionDraft = z.infer<typeof CopilotActionSchema>;

export async function POST(request: Request) {
  const body = RequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ content: "Please send a valid message for the Copilot to process." }, { status: 400 });
  }

  const { supabase, user } = await getSessionContext();

  await supabase.from("copilot_messages").insert({
    user_id: user.id,
    merchant_id: body.data.merchantId ?? null,
    role: "user",
    content: body.data.message,
  });

  const { data: merchants } = await supabase
    .from("merchants")
    .select("id,business_name,status,monthly_volume_estimate,proposed_rate,assigned_agent_id,updated_at")
    .limit(20);

  const result = isOpenAIConfigured()
    ? await buildOpenAIResponse(body.data.message, merchants ?? [])
    : buildStructuredFallback(body.data.message);

  const { data: assistantMessage } = await supabase
    .from("copilot_messages")
    .insert({
      user_id: user.id,
      merchant_id: body.data.merchantId ?? null,
      role: "assistant",
      content: result.content,
    })
    .select("*")
    .single<{ id: string }>();

  const actionRows = result.actions.map((action) => ({
    user_id: user.id,
    merchant_id: body.data.merchantId ?? (typeof action.payload?.merchant_id === "string" ? action.payload.merchant_id : null),
    action_type: action.action_type,
    action_summary: action.action_summary,
    status: action.requires_confirmation ? "requires_confirmation" : "suggested",
    payload: action.payload,
  }));

  const { data: persistedActions } = actionRows.length
    ? await supabase.from("copilot_actions").insert(actionRows).select("*")
    : { data: [] };

  return NextResponse.json({
    id: assistantMessage?.id ?? crypto.randomUUID(),
    content: result.content,
    actions: persistedActions ?? [],
  });
}

async function buildOpenAIResponse(message: string, merchants: unknown[]) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const merchantContext = merchants
    .map((merchant) => JSON.stringify(merchant))
    .join("\n");

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.2",
    input: [
      {
        role: "system",
        content:
          `You are ${brand.companyName} Agent Copilot for a merchant processing CRM. Extract likely CRM actions, missing fields, risks, and next best action. Major writes such as creating records, moving stages, creating tasks, or updating merchant data must require confirmation. Return concise JSON.`,
      },
      {
        role: "user",
        content: `Merchant context:\n${merchantContext}\n\nAgent message:\n${message}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "merchantdesk_copilot_response",
        schema: {
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
                  action_type: { type: "string" },
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
          },
          required: ["content", "actions"],
        },
      },
    },
  });

  const parsed = z
    .object({
      content: z.string(),
      actions: z.array(CopilotActionSchema),
    })
    .parse(JSON.parse(response.output_text));

  return parsed;
}

function buildStructuredFallback(message: string): { content: string; actions: CopilotActionDraft[] } {
  const lower = message.toLowerCase();

  if (lower.includes("follow") || lower.includes("tomorrow") || lower.includes("friday")) {
    return {
      content:
        "I found a follow-up intent. I would add this note to the merchant timeline, create a high-priority task for the requested date, and ask for statements if they have not been uploaded yet.",
      actions: [
        {
          action_type: "create_task",
          action_summary: "Create a follow-up task from the requested timing.",
          requires_confirmation: true,
          payload: { title: "Follow up with merchant", priority: "high" },
        },
        {
          action_type: "add_merchant_update",
          action_summary: "Add the call note to the merchant timeline.",
          requires_confirmation: true,
          payload: { update_type: "call", note: message },
        },
      ],
    };
  }

  if (lower.includes("new merchant") || lower.includes("called")) {
    return {
      content:
        "This looks like a new merchant. I can create a lead record, assign it to the current agent, and set the stage to New Lead. I would confirm contact email, phone, monthly volume, and current processor before underwriting.",
      actions: [
        {
          action_type: "create_merchant",
          action_summary: "Create a new merchant lead and assign it to the current agent.",
          requires_confirmation: true,
          payload: { source_text: message, status: "lead" },
        },
      ],
    };
  }

  if (lower.includes("underwriting") || lower.includes("move")) {
    return {
      content:
        "I can prepare a stage change. Before committing, I would verify the application package and documents are complete, then move the deal to Underwriting.",
      actions: [
        {
          action_type: "update_stage",
          action_summary: "Move the matched merchant to underwriting after confirmation.",
          requires_confirmation: true,
          payload: { status: "underwriting", source_text: message },
        },
      ],
    };
  }

  if (lower.includes("pipeline") || lower.includes("follow up")) {
    return {
      content:
        "Your best follow-up queue is Buffalo Auto Detail for approval risk, Elm Street Books for stale activity, and Joe's Pizza Works because the owner already committed to a near-term follow-up.",
      actions: [
        {
          action_type: "pipeline_summary",
          action_summary: "Rank stale leads and high-value follow-ups.",
          requires_confirmation: false,
          payload: null,
        },
      ],
    };
  }

  return {
    content:
      "I parsed the update and would convert it into a merchant note, check for missing info, and suggest the smallest next action that advances the deal.",
    actions: [
      {
        action_type: "next_best_action",
        action_summary: "Identify missing fields and recommend the next smallest deal-moving action.",
        requires_confirmation: false,
        payload: null,
      },
    ],
  };
}
