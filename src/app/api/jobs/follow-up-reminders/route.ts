import { NextResponse } from "next/server";
import { deliverNotification } from "@/lib/notification-delivery";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export async function GET(request: Request) {
  return runFollowUpReminderJob(request);
}

export async function POST(request: Request) {
  return runFollowUpReminderJob(request);
}

async function runFollowUpReminderJob(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  if (!expected || authHeader !== expected) {
    return NextResponse.json({ ok: false, message: "Unauthorized job request." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id,title,description,due_date,priority,merchant_id,assigned_to,profiles:assigned_to(id,full_name,email,phone),merchants:merchant_id(id,business_name)",
    )
    .neq("status", "completed")
    .gte("due_date", now.toISOString())
    .lte("due_date", windowEnd.toISOString());

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  let notificationCount = 0;

  for (const task of tasks ?? []) {
    const profile = Array.isArray(task.profiles) ? task.profiles[0] : task.profiles;
    if (!profile) continue;

    const merchant = Array.isArray(task.merchants) ? task.merchants[0] : task.merchants;
    const merchantName = merchant?.business_name ? ` for ${merchant.business_name}` : "";
    const dedupeKey = `follow-up-reminder:${task.id}:${now.toISOString().slice(0, 10)}`;
    const title = "Follow-up reminder";
    const body = `${task.title}${merchantName} is due ${new Date(task.due_date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}.`;

    let { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .upsert(
        {
          profile_id: profile.id,
          title,
          body,
          url: task.merchant_id ? `/merchants/${task.merchant_id}` : "/",
          dedupe_key: dedupeKey,
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle<{ id: string }>();

    if (notificationError && notificationError.message.toLowerCase().includes("dedupe_key")) {
      const fallback = await supabase
        .from("notifications")
        .insert({
          profile_id: profile.id,
          title,
          body,
          url: task.merchant_id ? `/merchants/${task.merchant_id}` : "/",
        })
        .select("id")
        .maybeSingle<{ id: string }>();
      notification = fallback.data;
      notificationError = fallback.error;
    }

    if (notificationError || !notification) continue;

    notificationCount += 1;
    await deliverNotification(supabase, {
      notificationId: notification.id,
      profile: profile as Pick<Profile, "id" | "email" | "phone" | "full_name">,
      title,
      body,
      url: task.merchant_id ? `/merchants/${task.merchant_id}` : "/",
    });
  }

  return NextResponse.json({ ok: true, notificationCount, checkedTasks: tasks?.length ?? 0 });
}
