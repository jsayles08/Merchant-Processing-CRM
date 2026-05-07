import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrmData } from "@/lib/types";

export function DocumentCenter({ data }: { data: CrmData }) {
  return (
    <section id="documents" className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Document Center</CardTitle>
          <CardDescription>Merchant files organized by account and document type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.documents.map((document) => {
            const merchant = data.merchants.find((item) => item.id === document.merchant_id);

            return (
              <Link
                key={document.id}
                href={merchant ? `/merchants/${merchant.id}` : "/merchants"}
                className="grid gap-3 rounded-lg border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40 md:grid-cols-[1fr_auto]"
              >
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{document.file_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{merchant?.business_name ?? "Unassigned merchant"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <Badge>{document.document_type}</Badge>
                  <span className="text-xs text-slate-500">{new Date(document.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            );
          })}
          {!data.documents.length ? <p className="text-sm text-slate-500">No merchant documents have been uploaded yet.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage Status</CardTitle>
          <CardDescription>Document links open from merchant profiles with signed access when stored privately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Summary label="Total documents" value={data.documents.length.toString()} />
          <Summary
            label="Private storage paths"
            value={data.documents.filter((document) => !document.file_url.startsWith("http") && !document.file_url.startsWith("/")).length.toString()}
          />
          <Summary
            label="Legacy public URLs"
            value={data.documents.filter((document) => document.file_url.startsWith("http") || document.file_url.startsWith("/")).length.toString()}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}
