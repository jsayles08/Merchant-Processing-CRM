import { NextResponse } from "next/server";
import { getProcessorProviderSummaries } from "@/lib/processor-integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, providers: getProcessorProviderSummaries() });
}
