"use server";

import { brand } from "@/lib/branding";

export type RequestAccessResult = {
  ok: boolean;
  error?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestAccess(email: string): Promise<RequestAccessResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!emailPattern.test(normalizedEmail)) {
    return { ok: false, error: "Enter a valid work email." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_EMAIL_FROM;
  const recipient = process.env.REQUEST_ACCESS_TO || process.env.NOTIFICATION_EMAIL_FROM;

  if (!apiKey || !from || !recipient) {
    return {
      ok: false,
      error: "Request access email delivery is not configured yet.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      reply_to: normalizedEmail,
      subject: `${brand.productName} access request`,
      text: `New ${brand.productName} access request:\n\n${normalizedEmail}`,
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      error: "The request could not be sent. Please try again in a minute.",
    };
  }

  return { ok: true };
}
