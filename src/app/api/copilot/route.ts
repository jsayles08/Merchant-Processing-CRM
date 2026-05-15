import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import {
  buildCopilotContext,
  buildCopilotSystemPrompt,
  buildStructuredFallback,
  copilotModel,
  getCopilotJsonSchema,
  sanitizeMemoryDrafts,
  type CopilotActionDraft,
  type CopilotStructuredResponse,
} from "@/lib/copilot-intelligence";
import { getCrmData } from "@/lib/data";
import { isOpenAIConfigured } from "@/lib/env";

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  merchantId: z.string().uuid().nullable().optional(),
});

const CopilotActionSchema: z.ZodType<CopilotActionDraft> = z.object({
  action_type: z.string(),
  action_summary: z.string(),
  requires_confirmation: z.boolean(),
  payload: z.record(z.string(), z.unknown()).nullable(),
});

const CopilotMemorySchema = z.object({
  scope: z.enum(["company", "merchant", "agent", "user"]),
  title: z.string(),
  content: z.string(),
  entity_id: z.string().nullable().optional(),
  confidence: z.number().optional(),
  source_type: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const CopilotResponseSchema: z.ZodType<CopilotStructuredResponse> = z.object({
  content: z.string(),
  actions: z.array(CopilotActionSchema),
  memories: z.array(CopilotMemorySchema),
  suggestions: z.array(z.string()),
});

export async function POST(request: Request) {
  const body = RequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ content: "Please send a valid message for the Copilot to process." }, { status: 400 });
  }

  const { supabase, user, profile } = await getSessionContext();

  await supabase.from("copilot_messages").insert({
    user_id: user.id,
    merchant_id: body.data.merchantId ?? null,
    role: "user",
    content: body.data.message,
  });

  const [data, recentMessagesResult] = await Promise.all([
    getCrmData(supabase),
    supabase
      .from("copilot_messages")
      .select("role,content,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const selectedMerchant = body.data.merchantId ? data.merchants.find((merchant) => merchant.id === body.data.merchantId) ?? null : null;
  const copilotSettings = getCopilotSettings(data.enterpriseSettings);

  let result: CopilotStructuredResponse;
  try {
    result = isOpenAIConfigured()
      ? await buildOpenAIResponse({
          message: body.data.message,
          profile,
          data,
          selectedMerchant,
          recentMessages: recentMessagesResult.data ?? [],
          model: copilotSettings.model,
          reasoning: copilotSettings.reasoning,
        })
      : buildStructuredFallback({
          message: body.data.message,
          merchantId: body.data.merchantId ?? null,
          data,
          selectedMerchant,
        });
  } catch (error) {
    console.warn("Copilot OpenAI response failed; using structured fallback.", error);
    result = buildStructuredFallback({
      message: body.data.message,
      merchantId: body.data.merchantId ?? null,
      data,
      selectedMerchant,
    });
  }

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

  const memories = copilotSettings.learningEnabled
    ? sanitizeMemoryDrafts(result.memories).map((memory) => ({
        ...memory,
        created_by: profile.id,
        source_id: assistantMessage?.id ?? null,
      }))
    : [];

  if (memories.length) {
    await supabase.from("copilot_memories").insert(memories);
  }

  const actionRows = result.actions.map((action) => ({
    user_id: user.id,
    merchant_id: body.data.merchantId ?? (typeof action.payload?.merchant_id === "string" ? action.payload.merchant_id : null),
    action_type: action.action_type,
    action_summary: action.action_summary,
    status: action.requires_confirmation ? "requires_confirmation" : "suggested",
    payload: action.payload,
  }));

  const { data: persistedActions, error: actionsError } = actionRows.length
    ? await supabase.from("copilot_actions").insert(actionRows).select("*")
    : { data: [], error: null };

  if (actionsError) {
    return NextResponse.json(
      {
        id: assistantMessage?.id ?? crypto.randomUUID(),
        content: `${result.content}\n\nI saved the message, but could not persist suggested actions: ${actionsError.message}`,
        actions: [],
        suggestions: result.suggestions,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    id: assistantMessage?.id ?? crypto.randomUUID(),
    content: result.content,
    actions: persistedActions ?? [],
    memoriesCreated: memories.length,
    model: copilotSettings.model,
    suggestions: result.suggestions,
  });
}

async function buildOpenAIResponse({
  data,
  message,
  model,
  profile,
  reasoning,
  recentMessages,
  selectedMerchant,
}: {
  data: Awaited<ReturnType<typeof getCrmData>>;
  message: string;
  model: string;
  profile: Awaited<ReturnType<typeof getSessionContext>>["profile"];
  reasoning: "none" | "low" | "medium" | "high" | "xhigh";
  recentMessages: { role: string; content: string; created_at: string }[];
  selectedMerchant: Awaited<ReturnType<typeof getCrmData>>["merchants"][number] | null;
}) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const context = buildCopilotContext({ data, memories: data.copilotMemories, selectedMerchant, recentMessages });
  const reasoningConfig = reasoning === "none" ? undefined : { effort: reasoning };

  const response = await client.responses.create({
    model,
    ...(reasoningConfig ? { reasoning: reasoningConfig } : {}),
    input: [
      {
        role: "system",
        content: buildCopilotSystemPrompt(profile),
      },
      {
        role: "user",
        content: `CRM context JSON:\n${context}\n\nAgent message:\n${message}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "merchantdesk_copilot_response",
        schema: getCopilotJsonSchema(),
      },
    },
  });

  return CopilotResponseSchema.parse(JSON.parse(response.output_text));
}

function getCopilotSettings(settings: Awaited<ReturnType<typeof getCrmData>>["enterpriseSettings"]) {
  const learningSetting = settings.find((setting) => setting.setting_key === "copilot_learning_enabled")?.setting_value;
  const modelSetting = settings.find((setting) => setting.setting_key === "copilot_model")?.setting_value;
  const model = typeof modelSetting?.model === "string" && modelSetting.model.trim() ? modelSetting.model.trim() : copilotModel;
  const reasoning =
    typeof modelSetting?.reasoning === "string" && ["none", "low", "medium", "high", "xhigh"].includes(modelSetting.reasoning)
      ? (modelSetting.reasoning as "none" | "low" | "medium" | "high" | "xhigh")
      : "medium";

  return {
    learningEnabled: learningSetting?.enabled !== false,
    model,
    reasoning,
  };
}
