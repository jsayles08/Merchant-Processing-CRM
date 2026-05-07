"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { uploadMerchantDocumentAction } from "@/lib/actions";
import type { CrmData } from "@/lib/types";

const documentTypes = ["Application", "Statement", "Void Check", "Processing Agreement", "Pricing", "Other"];

export function DocumentCenter({ data }: { data: CrmData }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [merchantId, setMerchantId] = useState(data.merchants[0]?.id ?? "");

  const privateDocuments = data.documents.filter((document) => !document.file_url.startsWith("http") && !document.file_url.startsWith("/"));
  const legacyDocuments = data.documents.filter((document) => document.file_url.startsWith("http") || document.file_url.startsWith("/"));

  function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await uploadMerchantDocumentAction(formData);
      setMessage(result.message);

      if (result.ok) {
        formRef.current?.reset();
        setMerchantId(data.merchants[0]?.id ?? "");
        router.refresh();
      }
    });
  }

  return (
    <section id="documents" className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
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
                className="crm-panel grid gap-3 rounded-3xl p-4 transition hover:bg-white/70 md:grid-cols-[1fr_auto]"
              >
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{document.file_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{merchant?.business_name ?? "Unassigned merchant"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <Badge className="rounded-full bg-[#0E5EC9] text-white">{document.document_type}</Badge>
                  <span className="text-xs text-slate-500">{new Date(document.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            );
          })}
          {!data.documents.length ? <p className="text-sm text-slate-500">No merchant documents have been uploaded yet.</p> : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>Attach merchant files to private Supabase storage.</CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} className="space-y-4" onSubmit={uploadDocument}>
              <div className="space-y-1.5">
                <Label htmlFor="merchant_id">Merchant</Label>
                <Select id="merchant_id" name="merchant_id" value={merchantId} onChange={(event) => setMerchantId(event.target.value)} required>
                  <option value="">Choose merchant</option>
                  {data.merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.business_name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="document_type">Document type</Label>
                <Select id="document_type" name="document_type" defaultValue="Application">
                  {documentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="file">File</Label>
                <Input id="file" name="file" type="file" required className="h-auto py-2 file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white" />
              </div>

              {message ? (
                <p className="rounded-2xl border border-black/10 bg-white/45 p-3 text-sm font-medium text-slate-700">{message}</p>
              ) : null}

              <Button className="w-full rounded-full" type="submit" disabled={isPending || !merchantId}>
                <UploadCloud className="h-4 w-4" />
                {isPending ? "Uploading..." : "Upload File"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage Status</CardTitle>
            <CardDescription>Private storage paths keep merchant files away from public URLs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Summary label="Total documents" value={data.documents.length.toString()} />
            <Summary label="Private storage paths" value={privateDocuments.length.toString()} />
            <Summary label="Legacy public URLs" value={legacyDocuments.length.toString()} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-panel flex items-center justify-between rounded-2xl p-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}
