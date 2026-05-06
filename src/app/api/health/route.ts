import { NextResponse } from "next/server";
import { brand } from "@/lib/branding";
import { getDocumentStorageMigrationStatus } from "@/lib/data";
import { getEnvironmentReport, isSupabaseAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const environment = getEnvironmentReport();
  const checks = {
    environment,
    database: {
      ok: false,
      message: "Supabase admin credentials are not configured.",
    },
    documents: {
      ok: true,
      message: "Document storage migration has not been checked.",
      publicUrlDocuments: 0,
      privatePathDocuments: 0,
      totalDocuments: 0,
    },
  };

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });

      checks.database = error
        ? { ok: false, message: error.message }
        : { ok: true, message: "Connected to Supabase." };

      const documentStatus = await getDocumentStorageMigrationStatus(supabase);
      checks.documents = {
        ok: documentStatus.public_url_documents === 0,
        message: documentStatus.public_url_documents
          ? `${documentStatus.public_url_documents} document rows still use public URLs.`
          : "All document rows use private storage paths.",
        publicUrlDocuments: documentStatus.public_url_documents,
        privatePathDocuments: documentStatus.private_path_documents,
        totalDocuments: documentStatus.total_documents,
      };
    } catch (error) {
      checks.database = {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to check Supabase.",
      };
    }
  }

  const requiredEnvOk = environment.supabaseUrl && environment.supabaseAnonKey && environment.supabaseServiceRoleKey;
  const ok = Boolean(requiredEnvOk && checks.database.ok);

  return NextResponse.json(
    {
      ok,
      service: brand.companyName,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
