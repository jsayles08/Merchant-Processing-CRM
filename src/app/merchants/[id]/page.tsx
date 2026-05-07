import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, FileUp, Mail, Phone, ReceiptText } from "lucide-react";
import { createMerchantUpdateAction, uploadMerchantDocumentAction } from "@/lib/actions";
import { getSessionContext } from "@/lib/auth";
import { getMerchantDetailData } from "@/lib/data";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { currency, percent, titleCase } from "@/lib/utils";

export default async function MerchantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await getSessionContext();
  const detail = await getMerchantDetailData(supabase, id);

  if (!detail) notFound();

  const estimatedResidual =
    detail.deal?.estimated_residual ??
    Math.round(detail.merchant.monthly_volume_estimate * (detail.merchant.proposed_rate / 100) * 0.28);
  async function saveMerchantUpdate(formData: FormData) {
    "use server";
    await createMerchantUpdateAction(formData);
  }

  async function uploadDocument(formData: FormData) {
    "use server";
    await uploadMerchantDocumentAction(formData);
  }

  return (
    <AppShell profile={profile} title={detail.merchant.business_name} eyebrow="Merchant profile" activeHref="/merchants">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/merchants" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-800">
          <ArrowLeft className="h-4 w-4" />
          Back to merchants
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{detail.merchant.business_name}</CardTitle>
                  <CardDescription>{detail.merchant.industry ?? "Merchant"} profile and onboarding workspace</CardDescription>
                </div>
                <Badge tone={detail.merchant.status === "processing" ? "emerald" : "blue"}>
                  {titleCase(detail.merchant.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Info label="Contact" value={detail.merchant.contact_name} icon={<Phone className="h-4 w-4" />} />
              <Info label="Phone" value={detail.merchant.contact_phone || "Missing"} icon={<Phone className="h-4 w-4" />} />
              <Info label="Email" value={detail.merchant.contact_email || "Missing"} icon={<Mail className="h-4 w-4" />} />
              <Info label="Assigned agent" value={detail.assignedProfile?.full_name ?? "Unassigned"} icon={<ReceiptText className="h-4 w-4" />} />
              <Info label="Monthly volume" value={currency(detail.merchant.monthly_volume_estimate)} icon={<ReceiptText className="h-4 w-4" />} />
              <Info label="Proposed rate" value={percent(detail.merchant.proposed_rate)} icon={<ReceiptText className="h-4 w-4" />} />
              <Info label="Residual estimate" value={currency(estimatedResidual)} icon={<ReceiptText className="h-4 w-4" />} />
              <Info label="Processing start" value={detail.merchant.processing_start_date ?? "Not processing"} icon={<CalendarClock className="h-4 w-4" />} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Copilot Summary</CardTitle>
              <CardDescription>Account risk, next step, and missing information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>{detail.merchant.notes || "No notes have been added for this merchant yet."}</p>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                Next recommended action: confirm current processor statements, then schedule underwriting or onboarding
                follow-up based on stage.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Updates & Follow-ups</CardTitle>
              <CardDescription>Add notes and automatically create follow-up tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form action={saveMerchantUpdate} className="space-y-3">
                <input type="hidden" name="merchant_id" value={detail.merchant.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Update type</Label>
                    <Select name="update_type" defaultValue="note">
                      <option value="note">Note</option>
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="pricing">Pricing</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Next follow-up</Label>
                    <Input name="next_follow_up_date" type="datetime-local" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Note</Label>
                  <Textarea name="note" required placeholder="What happened, what is missing, and what should happen next?" />
                </div>
                <Button type="submit">Save Update</Button>
              </form>

              <div className="space-y-3">
                {detail.updates.map((update) => (
                  <div key={update.id} className="rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <Badge>{titleCase(update.update_type)}</Badge>
                      <span className="text-xs text-slate-500">{new Date(update.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-slate-600 dark:text-slate-300">{update.note}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Upload statements, applications, bank letters, and onboarding files.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form action={uploadDocument} className="space-y-3">
                <input type="hidden" name="merchant_id" value={detail.merchant.id} />
                <div className="space-y-1.5">
                  <Label>Document type</Label>
                  <Select name="document_type" defaultValue="Processing statements">
                    <option>Processing statements</option>
                    <option>Merchant application</option>
                    <option>Voided check</option>
                    <option>Bank letter</option>
                    <option>PCI documentation</option>
                    <option>Other</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>File</Label>
                  <Input name="file" type="file" required />
                </div>
                <Button type="submit">
                  <FileUp className="h-4 w-4" />
                  Upload Document
                </Button>
              </form>

              <div className="space-y-3">
                {detail.documents.map((document) => (
                  <a
                    key={document.id}
                    href={document.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-slate-100 p-3 text-sm transition hover:border-emerald-300 dark:border-slate-800"
                  >
                    <p className="font-medium text-slate-950 dark:text-white">{document.file_name}</p>
                    <p className="mt-1 text-slate-500">{document.document_type}</p>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
