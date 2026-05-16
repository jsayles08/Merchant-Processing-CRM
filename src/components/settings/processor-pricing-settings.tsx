"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, CircleDollarSign, RotateCcw, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { recalculateProcessorPricingAction, upsertProcessorPricingSettingAction } from "@/lib/actions";
import { formatProcessorPricing, normalizeProcessorKey } from "@/lib/processor-pricing";
import type { CrmData, ProcessorPricingSetting, ProcessorPricingUnit } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";

type FormState = {
  id: string;
  processor_name: string;
  pricing_unit: ProcessorPricingUnit;
  rate_value: string;
  flat_fee: string;
  effective_at: string;
  is_active: boolean;
  notes: string;
};

const blankForm: FormState = {
  id: "",
  processor_name: "Fiserv",
  pricing_unit: "basis_points",
  rate_value: "1.5",
  flat_fee: "",
  effective_at: new Date().toISOString().slice(0, 10),
  is_active: true,
  notes: "",
};

const pricingUnits: { value: ProcessorPricingUnit; label: string; hint: string }[] = [
  { value: "basis_points", label: "Basis points", hint: "1.5 bps = 0.015% of volume" },
  { value: "basis_points_plus_flat", label: "Basis points + flat", hint: "Volume bps plus a fixed monthly fee" },
  { value: "percentage", label: "Percent of gross", hint: "Percent of gross processing revenue" },
  { value: "percentage_plus_flat", label: "Percent + flat", hint: "Percent of gross plus fixed fee" },
  { value: "flat_fee", label: "Flat fee", hint: "Fixed processor charge" },
];

export function ProcessorPricingSettings({ data }: { data: CrmData }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [isRecalculating, startRecalculating] = useTransition();
  const [form, setForm] = useState<FormState>(blankForm);
  const [message, setMessage] = useState("");
  const [recalc, setRecalc] = useState({
    includeDeals: true,
    includeResiduals: false,
    includeLockedResiduals: false,
  });

  const rows = useMemo(
    () =>
      [...data.processorPricingSettings].sort((a, b) => {
        const activeCompare = Number(b.is_active) - Number(a.is_active);
        return activeCompare || b.effective_at.localeCompare(a.effective_at) || a.processor_name.localeCompare(b.processor_name);
      }),
    [data.processorPricingSettings],
  );
  const activeRows = rows.filter((row) => row.is_active);
  const fiservRow = activeRows.find((row) => row.processor_key === "fiserv");
  const latestRow = rows[0];

  function update<TKey extends keyof FormState>(key: TKey, value: FormState[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(row: ProcessorPricingSetting) {
    setForm({
      id: isUuid(row.id) ? row.id : "",
      processor_name: row.processor_name,
      pricing_unit: row.pricing_unit,
      rate_value: String(row.rate_value ?? 0),
      flat_fee: row.flat_fee == null ? "" : String(row.flat_fee),
      effective_at: row.effective_at.slice(0, 10),
      is_active: row.is_active,
      notes: row.notes ?? "",
    });
    setMessage(`Editing ${row.processor_name} ${formatProcessorPricing(row)}.`);
  }

  function save() {
    startSaving(async () => {
      const result = await upsertProcessorPricingSettingAction({
        id: form.id || undefined,
        processor_name: form.processor_name,
        pricing_unit: form.pricing_unit,
        rate_value: Number(form.rate_value),
        flat_fee: form.flat_fee ? Number(form.flat_fee) : null,
        effective_at: form.effective_at,
        is_active: form.is_active,
        notes: form.notes,
      });

      setMessage(result.message);
      if (result.ok) {
        setForm(blankForm);
        router.refresh();
      }
    });
  }

  function recalculate() {
    startRecalculating(async () => {
      const result = await recalculateProcessorPricingAction(recalc);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Processor Pricing</CardTitle>
            <CardDescription>Control processor charges used in margins, residuals, compensation, reports, and payroll-ready exports.</CardDescription>
          </div>
          <Badge tone="amber">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin finance control
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <PricingStat icon={<CircleDollarSign className="h-4 w-4" />} label="Active processors" value={activeRows.length.toString()} detail={`${rows.length} total versions`} />
          <PricingStat icon={<Calculator className="h-4 w-4" />} label="Fiserv active rate" value={fiservRow ? formatProcessorPricing(fiservRow) : "Not configured"} detail="Default fallback is 1.5 bps" />
          <PricingStat icon={<SlidersHorizontal className="h-4 w-4" />} label="Latest change" value={latestRow?.processor_name ?? "None"} detail={latestRow ? `${formatProcessorPricing(latestRow)} effective ${latestRow.effective_at.slice(0, 10)}` : "Add the first rate"} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="crm-panel rounded-[24px] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase text-[#25425E]/60">Rate editor</p>
                <p className="mt-1 text-sm leading-6 text-[#25425E]/75">Use basis points for processor costs like Fiserv 1.5 bps. Percent values apply to gross processing revenue.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setForm(blankForm)}>
                New
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Processor">
                <Input value={form.processor_name} onChange={(event) => update("processor_name", event.target.value)} placeholder="Fiserv" />
              </Field>
              <Field label="Processor key">
                <Input value={normalizeProcessorKey(form.processor_name)} readOnly />
              </Field>
              <Field label="Fee type">
                <Select value={form.pricing_unit} onChange={(event) => update("pricing_unit", event.target.value as ProcessorPricingUnit)}>
                  {pricingUnits.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </Select>
                <p className="text-xs font-medium text-[#25425E]/60">
                  {pricingUnits.find((unit) => unit.value === form.pricing_unit)?.hint}
                </p>
              </Field>
              <Field label={form.pricing_unit.includes("basis_points") ? "Basis points" : form.pricing_unit.includes("percentage") ? "Percent" : "Flat fee"}>
                <Input type="number" step="0.0001" min="0" value={form.rate_value} onChange={(event) => update("rate_value", event.target.value)} />
              </Field>
              <Field label="Additional flat fee">
                <Input type="number" step="0.01" min="0" value={form.flat_fee} onChange={(event) => update("flat_fee", event.target.value)} placeholder="Optional" />
              </Field>
              <Field label="Effective date">
                <Input type="date" value={form.effective_at} onChange={(event) => update("effective_at", event.target.value)} />
              </Field>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[#ABB7C0]/25 bg-white/55 p-3 text-sm">
              <input className="mt-1 h-4 w-4 accent-[#0E5EC9]" type="checkbox" checked={form.is_active} onChange={(event) => update("is_active", event.target.checked)} />
              <span>
                <span className="block font-semibold text-[#0B0F15]">Active pricing version</span>
                <span className="text-[#25425E]/70">Inactive rows stay in history and are skipped by future calculations.</span>
              </span>
            </label>

            <Field label="Notes">
              <Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Contract source, approval note, or pricing exception." />
            </Field>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={save} disabled={isSaving || !form.processor_name.trim()}>
                <Save className="h-4 w-4" />
                Save Pricing
              </Button>
              <Button type="button" variant="secondary" onClick={() => setForm(blankForm)}>
                Clear
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-[24px] border border-[#ABB7C0]/25 bg-white/55">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-[#FDFDFD]/80 text-left text-xs uppercase text-[#25425E]/70">
                    <tr>
                      <th className="px-4 py-3">Processor</th>
                      <th className="px-4 py-3">Rate</th>
                      <th className="px-4 py-3">Effective</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ABB7C0]/20">
                    {rows.map((row) => (
                      <tr key={row.id} className="bg-white/45">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#0B0F15]">{row.processor_name}</p>
                          <p className="text-xs text-[#25425E]/60">{row.processor_key}</p>
                        </td>
                        <td className="px-4 py-3">{formatProcessorPricing(row)}</td>
                        <td className="px-4 py-3">{row.effective_at.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={row.is_active ? "blue" : "slate"}>{row.is_active ? "Active" : "Inactive"}</Badge>
                        </td>
                        <td className="px-4 py-3 text-[#25425E]/70">{new Date(row.updated_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Button type="button" size="sm" variant="secondary" onClick={() => edit(row)}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!rows.length ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-[#25425E]/70" colSpan={6}>
                          No processor pricing records yet. Add Fiserv at 1.5 basis points to keep the current processor-cost baseline configurable.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="crm-panel rounded-[24px] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-black text-[#0B0F15]">Controlled Recalculation</p>
                  <p className="mt-1 text-sm leading-6 text-[#25425E]/70">Future and open deal estimates can update immediately. Locked, paid, or exported residual rows stay protected unless explicitly included.</p>
                </div>
                <Button type="button" variant="secondary" onClick={recalculate} disabled={isRecalculating}>
                  <RotateCcw className="h-4 w-4" />
                  Recalculate
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <CheckControl label="Open deal estimates" detail="Pipeline and margin estimates" checked={recalc.includeDeals} onChange={(checked) => setRecalc((current) => ({ ...current, includeDeals: checked }))} />
                <CheckControl label="Unpaid residual rows" detail="Unlocked residual math" checked={recalc.includeResiduals} onChange={(checked) => setRecalc((current) => ({ ...current, includeResiduals: checked }))} />
                <CheckControl label="Locked/exported rows" detail="Requires admin intent" checked={recalc.includeLockedResiduals} onChange={(checked) => setRecalc((current) => ({ ...current, includeLockedResiduals: checked, includeResiduals: checked ? true : current.includeResiduals }))} />
              </div>
            </div>
          </div>
        </div>

        {message ? <p className="crm-panel rounded-2xl p-3 text-sm font-semibold text-[#25425E]">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function PricingStat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="crm-panel rounded-2xl p-3">
      <p className="flex items-center gap-2 text-xs font-black uppercase text-[#25425E]/60">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-[#0B0F15]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[#25425E]/65">{detail}</p>
    </div>
  );
}

function CheckControl({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-[#ABB7C0]/25 bg-white/55 p-3 text-sm">
      <input className="mt-1 h-4 w-4 accent-[#0E5EC9]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="block font-semibold text-[#0B0F15]">{label}</span>
        <span className="text-[#25425E]/70">{detail}</span>
      </span>
    </label>
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
