import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user } = await getSessionContext();

  const { data, error } = await supabase
    .from("copilot_actions")
    .update({ status: "dismissed" })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["suggested", "requires_confirmation"])
    .select("id,status")
    .maybeSingle<{ id: string; status: string }>();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, message: "Action was not found or is already closed." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, message: "Copilot action dismissed.", status: data.status });
}
