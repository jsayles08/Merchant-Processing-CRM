import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

type DeliveryPayload = {
  notificationId: string;
  profile: Pick<Profile, "id" | "email" | "phone" | "full_name">;
  title: string;
  body: string;
  url?: string | null;
};

export async function deliverNotification(supabase: SupabaseClient, payload: DeliveryPayload) {
  await Promise.all([
    deliverEmail(supabase, payload),
    deliverSms(supabase, payload),
  ]);
}

async function deliverEmail(supabase: SupabaseClient, payload: DeliveryPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_EMAIL_FROM;

  if (!apiKey || !from || !payload.profile.email) {
    await recordDelivery(supabase, payload, {
      channel: "email",
      provider: "resend",
      recipient: payload.profile.email,
      status: "skipped",
      errorMessage: "Email provider or recipient is not configured.",
    });
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.profile.email],
        subject: payload.title,
        text: `${payload.body}${payload.url ? `\n\n${payload.url}` : ""}`,
      }),
    });

    await recordDelivery(supabase, payload, {
      channel: "email",
      provider: "resend",
      recipient: payload.profile.email,
      status: response.ok ? "sent" : "failed",
      errorMessage: response.ok ? null : await response.text(),
    });
  } catch (error) {
    await recordDelivery(supabase, payload, {
      channel: "email",
      provider: "resend",
      recipient: payload.profile.email,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown email delivery error.",
    });
  }
}

async function deliverSms(supabase: SupabaseClient, payload: DeliveryPayload) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from || !payload.profile.phone) {
    await recordDelivery(supabase, payload, {
      channel: "sms",
      provider: "twilio",
      recipient: payload.profile.phone,
      status: "skipped",
      errorMessage: "SMS provider or recipient is not configured.",
    });
    return;
  }

  try {
    const body = new URLSearchParams({
      From: from,
      To: payload.profile.phone,
      Body: `${payload.title}: ${payload.body}`,
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    await recordDelivery(supabase, payload, {
      channel: "sms",
      provider: "twilio",
      recipient: payload.profile.phone,
      status: response.ok ? "sent" : "failed",
      errorMessage: response.ok ? null : await response.text(),
    });
  } catch (error) {
    await recordDelivery(supabase, payload, {
      channel: "sms",
      provider: "twilio",
      recipient: payload.profile.phone,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown SMS delivery error.",
    });
  }
}

async function recordDelivery(
  supabase: SupabaseClient,
  payload: DeliveryPayload,
  delivery: {
    channel: "email" | "sms";
    provider: string;
    recipient: string | null;
    status: "sent" | "skipped" | "failed";
    errorMessage: string | null;
  },
) {
  await supabase.from("notification_deliveries").insert({
    notification_id: payload.notificationId,
    profile_id: payload.profile.id,
    channel: delivery.channel,
    provider: delivery.provider,
    recipient: delivery.recipient,
    status: delivery.status,
    error_message: delivery.errorMessage,
    metadata: { title: payload.title },
  });
}

