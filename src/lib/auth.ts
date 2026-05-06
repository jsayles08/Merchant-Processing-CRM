import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";

export async function getSessionContext() {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single<Profile>();

  if (error || !profile) {
    redirect("/profile-required");
  }

  return { supabase, user, profile };
}

export function requireRole(profile: Profile, roles: Profile["role"][]) {
  if (!roles.includes(profile.role)) {
    redirect("/");
  }
}
