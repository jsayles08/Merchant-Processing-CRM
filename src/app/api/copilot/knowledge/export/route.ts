import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { brand } from "@/lib/branding";
import { copilotModel } from "@/lib/copilot-intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, profile } = await getSessionContext();

  if (profile.role !== "admin") {
    return NextResponse.json({ message: "Only admins can export Copilot memory." }, { status: 403 });
  }

  const { data: settings, error: settingsError } = await supabase.from("enterprise_settings").select("*").in("setting_key", [
    "copilot_learning_enabled",
    "copilot_model",
    "copilot_memory_export_enabled",
  ]);

  if (settingsError) {
    return NextResponse.json({ message: settingsError.message }, { status: 500 });
  }

  const exportSetting = settings?.find((setting) => setting.setting_key === "copilot_memory_export_enabled")?.setting_value;
  if (isDisabled(exportSetting)) {
    return NextResponse.json({ message: "Copilot memory export is disabled by enterprise policy." }, { status: 403 });
  }

  const [{ data: memories, error: memoryError }, { data: actions, error: actionsError }] = await Promise.all([
    supabase.from("copilot_memories").select("*").order("updated_at", { ascending: false }),
    supabase
      .from("copilot_actions")
      .select("action_type,action_summary,status,payload,created_at,confirmed_at")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  if (memoryError || actionsError) {
    return NextResponse.json(
      { message: memoryError?.message ?? actionsError?.message ?? "Export failed." },
      { status: 500 },
    );
  }

  await writeAuditLog(supabase, profile, {
    action: "copilot.memory_export",
    entityType: "copilot_memory",
    summary: `${profile.full_name} exported Copilot learned memory.`,
    metadata: { memory_count: memories?.length ?? 0, action_count: actions?.length ?? 0 },
  });

  return NextResponse.json({
    exportType: "merchantdesk-copilot-memory",
    exportedAt: new Date().toISOString(),
    product: brand.productName,
    model: copilotModel,
    counts: {
      memories: memories?.length ?? 0,
      recentActions: actions?.length ?? 0,
      settings: settings?.length ?? 0,
    },
    portabilityNotes: [
      "This export contains retained Copilot memory and recent action metadata, not raw API keys or service credentials.",
      "Import memories into another CRM/LLM product as durable company instructions, sales playbooks, merchant-processing policies, and workflow preferences.",
      "Review records before import if your next provider has different privacy or retention requirements.",
    ],
    settings: settings ?? [],
    memories: memories ?? [],
    recentActionPatterns: actions ?? [],
  });
}

function isDisabled(settingValue: unknown) {
  return Boolean(
    typeof settingValue === "object" &&
      settingValue &&
      "enabled" in settingValue &&
      (settingValue as { enabled?: unknown }).enabled === false,
  );
}
