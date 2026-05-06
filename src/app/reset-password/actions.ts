"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) {
    redirect("/reset-password?error=Password%20must%20be%20at%20least%208%20characters.");
  }

  if (password !== confirmPassword) {
    redirect("/reset-password?error=Passwords%20do%20not%20match.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Password%20updated.%20Sign%20in%20with%20your%20new%20password.");
}
