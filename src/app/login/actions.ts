"use server";

import { redirect } from "next/navigation";
import { writeProfileActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";
import type { Profile } from "@/lib/types";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", data.user.id)
      .maybeSingle<Profile>();

    if (profile) {
      await writeProfileActivity(supabase, profile, "agent.auth.login", `${profile.full_name} signed in.`);
    }
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Profile>();

    if (profile) {
      await writeProfileActivity(supabase, profile, "agent.auth.logout", `${profile.full_name} signed out.`);
      await supabase
        .from("agent_presence")
        .upsert(
          {
            profile_id: profile.id,
            status: "offline",
            last_seen_at: new Date().toISOString(),
            current_path: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "profile_id" },
        );
    }
  }

  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");

  if (!email) {
    redirect("/login?error=Enter%20your%20email%20to%20request%20a%20reset%20link.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Password%20reset%20link%20sent.%20Check%20your%20email.");
}
