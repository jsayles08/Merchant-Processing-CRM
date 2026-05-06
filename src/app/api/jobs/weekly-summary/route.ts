import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  return runWeeklySummaryJob(request);
}

export async function POST(request: Request) {
  return runWeeklySummaryJob(request);
}

async function runWeeklySummaryJob(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  if (!expected || authHeader !== expected) {
    return NextResponse.json({ ok: false, message: "Unauthorized job request." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const weekStart = getWeekStart(new Date()).toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("create_weekly_agent_performance_summaries", {
    target_week_start: weekStart,
  });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    weekStart,
    updatedSummaries: data,
  });
}

function getWeekStart(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy;
}
