import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAgentActivity } from "@/lib/activity";
import { getSessionContext } from "@/lib/auth";
import type { AgentPresence, PresenceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const HeartbeatSchema = z.object({
  status: z.enum(["online", "away", "offline"]).default("online"),
  path: z.string().max(240).optional(),
});

export async function POST(request: Request) {
  const parsed = HeartbeatSchema.safeParse(await safeJson(request));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { supabase, profile } = await getSessionContext();
  const { data: existing } = await supabase
    .from("agent_presence")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle<AgentPresence>();

  const now = new Date().toISOString();
  const userAgent = request.headers.get("user-agent");
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { data, error } = await supabase
    .from("agent_presence")
    .upsert(
      {
        profile_id: profile.id,
        status: parsed.data.status,
        last_seen_at: now,
        current_path: parsed.data.path ?? null,
        user_agent: userAgent,
        updated_at: now,
      },
      { onConflict: "profile_id" },
    )
    .select("*")
    .single<AgentPresence>();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Presence was not updated." }, { status: 500 });
  }

  const changedStatus = existing?.status !== parsed.data.status;
  const becameOnline = parsed.data.status === "online" && (!existing || isPresenceStale(existing.last_seen_at));
  if (changedStatus || becameOnline) {
    await writeAgentActivity(supabase, {
      profileId: profile.id,
      actorProfileId: profile.id,
      eventType: `agent.presence.${parsed.data.status}`,
      eventSource: "presence",
      severity: parsed.data.status === "offline" ? "warning" : "info",
      summary: `${profile.full_name} is ${formatPresence(parsed.data.status)}.`,
      metadata: { path: parsed.data.path ?? null, previous_status: existing?.status ?? null },
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true, presence: data });
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isPresenceStale(lastSeenAt: string) {
  return Date.now() - new Date(lastSeenAt).getTime() > 5 * 60 * 1000;
}

function formatPresence(status: PresenceStatus) {
  if (status === "away") return "away";
  if (status === "offline") return "offline";
  return "online";
}
