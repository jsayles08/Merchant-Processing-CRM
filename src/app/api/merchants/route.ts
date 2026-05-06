import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";

const MerchantSchema = z.object({
  business_name: z.string().min(1),
  contact_name: z.string().min(1),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  industry: z.string().optional(),
  monthly_volume_estimate: z.number().nonnegative().default(0),
  average_ticket: z.number().nonnegative().default(0),
  current_processor: z.string().optional(),
  proposed_rate: z.number().nonnegative().default(1.5),
  status: z.string().default("lead"),
  assigned_agent_id: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET() {
  const { supabase } = await getSessionContext();
  const { data, error } = await supabase.from("merchants").select("*").order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ merchants: data });
}

export async function POST(request: Request) {
  const body = MerchantSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const requiresApproval = body.data.proposed_rate < 1.5;

  const { supabase, profile } = await getSessionContext();
  const { data: currentAgent } = await supabase.from("agents").select("id").eq("profile_id", profile.id).maybeSingle<{ id: string }>();
  const assignedAgentId = profile.role === "agent" ? currentAgent?.id : body.data.assigned_agent_id;

  if (!assignedAgentId) {
    return NextResponse.json({ error: "No agent assignment is available." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("merchants")
    .insert({ ...body.data, assigned_agent_id: assignedAgentId })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("deals").insert({
    merchant_id: data.id,
    agent_id: assignedAgentId,
    stage: body.data.status,
    proposed_rate: body.data.proposed_rate,
    requires_management_approval: requiresApproval,
    approval_status: requiresApproval ? "pending" : "not_required",
    estimated_monthly_volume: body.data.monthly_volume_estimate,
    estimated_residual: Math.round(body.data.monthly_volume_estimate * (body.data.proposed_rate / 100) * 0.28),
  });

  return NextResponse.json({ merchant: data }, { status: 201 });
}
