"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, FileSignature, FileText, SendHorizontal, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { createSignatureRequestAction, updateSignatureRequestStatusAction, uploadMerchantDocumentAction } from "@/lib/actions";
import type { CrmData, SignatureEntityType, SignatureStatus } from "@/lib/types";
import { labelForStatus, signatureStatuses } from "@/lib/workflow-constants";

const documentTypes = ["Application", "Statement", "Void Check", "Processing Agreement", "Pricing", "Other"];
const relatedEntityTypes: { value: SignatureEntityType; label: string }[] = [
  { value: "merchant", label: "Merchant" },
  { value: "agent", label: "Agent" },
  { value: "recruit", label: "Recruit" },
  { value: "account", label: "Account" },
];

export function DocumentCenter({ data }: { data: CrmData }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [merchantId, setMerchantId] = useState(data.merchants[0]?.id ?? "");
  const [signatureTitle, setSignatureTitle] = useState("Merchant processing agreement");
  const [recipientName, setRecipientName] = useState(data.merchants[0]?.contact_name ?? "");
  const [recipientEmail, setRecipientEmail] = useState(data.merchants[0]?.contact_email ?? "");
  const [recipientProfileId, setRecipientProfileId] = useState("");
  const [relatedEntityType, setRelatedEntityType] = useState<SignatureEntityType>("merchant");
  const [relatedEntityId, setRelatedEntityId] = useState(data.merchants[0]?.id ?? "");
  const [documentId, setDocumentId] = useState(data.documents[0]?.id ?? "");
  const [sendNow, setSendNow] = useState(true);

  const privateDocuments = data.documents.filter((document) => !document.file_url.startsWith("http") && !document.file_url.startsWith("/"));
  const legacyDocuments = data.documents.filter((document) => document.file_url.startsWith("http") || document.file_url.startsWith("/"));
  const relatedEntityOptions = buildRelatedEntityOptions(data, relatedEntityType);

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

  function createSignatureRequest() {
    startTransition(async () => {
      const result = await createSignatureRequestAction({
        title: signatureTitle,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        recipient_profile_id: recipientProfileId,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        document_id: documentId,
        send_now: sendNow,
      });
      setMessage(result.message);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  function updateSignatureStatus(signatureRequestId: string, status: SignatureStatus) {
    startTransition(async () => {
      const result = await updateSignatureRequestStatusAction({ signature_request_id: signatureRequestId, status });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section id="documents" className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Send For Signature</CardTitle>
            <CardDescription>Create a trackable signature request for agents, recruits, merchants, or accounts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Title">
              <Input value={signatureTitle} onChange={(event) => setSignatureTitle(event.target.value)} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Recipient name">
                <Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
              </Field>
              <Field label="Recipient email">
                <Input value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} />
              </Field>
              <Field label="Recipient user">
                <Select value={recipientProfileId} onChange={(event) => setRecipientProfileId(event.target.value)}>
                  <option value="">External recipient</option>
                  {data.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Document">
                <Select value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
                  <option value="">No uploaded document</option>
                  {data.documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.file_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Related entity">
                <Select
                  value={relatedEntityType}
                  onChange={(event) => {
                    const nextType = event.target.value as SignatureEntityType;
                    setRelatedEntityType(nextType);
                    setRelatedEntityId(buildRelatedEntityOptions(data, nextType)[0]?.id ?? "");
                  }}
                >
                  {relatedEntityTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Record">
                <Select value={relatedEntityId} onChange={(event) => setRelatedEntityId(event.target.value)}>
                  <option value="">No record</option>
                  {relatedEntityOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="crm-panel flex items-center justify-between gap-3 rounded-[20px] p-3 text-sm font-semibold text-[#25425E]">
              Send immediately
              <input type="checkbox" checked={sendNow} onChange={(event) => setSendNow(event.target.checked)} />
            </label>
            <Button className="w-full" type="button" onClick={createSignatureRequest} disabled={isPending}>
              <SendHorizontal className="h-4 w-4" />
              {sendNow ? "Send Signature Request" : "Save Draft"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signature Tracker</CardTitle>
            <CardDescription>Status tracking for documents that need signatures.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data.signatureRequests.length ? (
              <div className="crm-panel flex min-h-44 flex-col items-center justify-center rounded-[24px] p-6 text-center">
                <FileSignature className="h-6 w-6 text-[#0E5EC9]" />
                <p className="mt-2 text-sm font-bold text-[#0B0F15]">No signature requests yet</p>
                <p className="mt-1 max-w-sm text-sm text-[#25425E]/70">Send a document request to begin tracking signature status.</p>
              </div>
            ) : null}
            {data.signatureRequests.map((request) => (
              <div key={request.id} className="crm-panel rounded-[24px] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[#0B0F15]">{request.title}</p>
                      <Badge tone={signatureTone(request.status)}>{labelForStatus(request.status, signatureStatuses)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#25425E]/70">
                      {request.recipient_name} · {request.recipient_email} · {request.provider}
                    </p>
                    {request.signing_url ? (
                      <Link className="mt-2 inline-flex text-sm font-semibold text-[#0E5EC9]" href={request.signing_url}>
                        Open signing link
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {signatureStatuses.map((status) => (
                      <Button
                        key={status.value}
                        size="sm"
                        variant={request.status === status.value ? "primary" : "secondary"}
                        type="button"
                        disabled={isPending}
                        onClick={() => updateSignatureStatus(request.id, status.value)}
                      >
                        {status.value === "signed" ? <CheckCircle2 className="h-4 w-4" /> : null}
                        {status.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function buildRelatedEntityOptions(data: CrmData, entityType: SignatureEntityType) {
  if (entityType === "merchant") {
    return data.merchants.map((merchant) => ({ id: merchant.id, label: merchant.business_name }));
  }

  if (entityType === "agent") {
    return data.agents.map((agent) => {
      const profile = data.profiles.find((item) => item.id === agent.profile_id);
      return { id: agent.id, label: profile?.full_name ?? agent.agent_code };
    });
  }

  if (entityType === "recruit") {
    return data.agentRecruits.map((recruit) => ({ id: recruit.id, label: recruit.full_name }));
  }

  return data.profiles.map((profile) => ({ id: profile.id, label: profile.full_name }));
}

function signatureTone(status: SignatureStatus) {
  if (status === "signed") return "blue";
  if (status === "declined" || status === "expired") return "rose";
  if (status === "sent" || status === "viewed") return "amber";
  return "slate";
}
