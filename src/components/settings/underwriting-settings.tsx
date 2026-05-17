"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Play, PlusCircle, Save, ShieldAlert, Trash2 } from "lucide-react";
import { runUnderwritingDecisionAction, saveUnderwritingRulesAction } from "@/lib/actions";
import type { CrmData, UnderwritingOutcome, UnderwritingRule } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";

type RuleDraft = {
  id: string;
  name: string;
  outcome: UnderwritingOutcome;
  enabled: boolean;
  priority: number;
  minMonthlyVolume: string;
  maxMonthlyVolume: string;
  minAverageTicket: string;
  maxAverageTicket: string;
  minProposedRate: string;
  maxProposedRate: string;
  minDocumentCompletionRate: string;
  maxDocumentCompletionRate: string;
  riskKeywords: string;
};

export function UnderwritingSettings({ data }: { data: CrmData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [rules, setRules] = useState<RuleDraft[]>(() => data.underwritingRules.map(toDraft));
  const [deletedRuleIds, setDeletedRuleIds] = useState<string[]>([]);
  const [autoDecisionsEnabled, setAutoDecisionsEnabled] = useState(
    () => data.enterpriseSettings.find((setting) => setting.setting_key === "underwriting_auto_decisions_enabled")?.setting_value?.enabled !== false,
  );
  const pendingApplications = data.merchantOnboardingRecords.filter((record) =>
    ["application_started", "documents_needed", "under_review"].includes(record.status),
  );
  const recentDecisions = useMemo(() => data.underwritingDecisions.slice(0, 6), [data.underwritingDecisions]);

  function update(index: number, key: keyof RuleDraft, value: string | boolean | number) {
    setRules((current) => current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, [key]: value } : rule)));
  }

  function addRule() {
    setRules((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "New underwriting rule",
        outcome: "manual_review",
        enabled: true,
        priority: current.length ? Math.min(999, Math.max(...current.map((rule) => rule.priority)) + 10) : 100,
        minMonthlyVolume: "",
        maxMonthlyVolume: "",
        minAverageTicket: "",
        maxAverageTicket: "",
        minProposedRate: "",
        maxProposedRate: "",
        minDocumentCompletionRate: "",
        maxDocumentCompletionRate: "",
        riskKeywords: "",
      },
    ]);
  }

  function removeRule(rule: RuleDraft) {
    setRules((current) => current.filter((item) => item.id !== rule.id));
    if (data.underwritingRules.some((item) => item.id === rule.id)) {
      setDeletedRuleIds((current) => [...new Set([...current, rule.id])]);
    }
  }

  function saveRules() {
    startTransition(async () => {
      const result = await saveUnderwritingRulesAction({
        rules: rules.map(fromDraft),
        deletedRuleIds,
        autoDecisionsEnabled,
      });
      setMessage(result.message);
      if (result.ok) {
        setDeletedRuleIds([]);
        router.refresh();
      }
    });
  }

  function runAll() {
    startTransition(async () => {
      const result = await runUnderwritingDecisionAction({});
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section id="underwriting-settings" className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Underwriting Automation</CardTitle>
              <CardDescription>Configure automatic approval, denial, and manual-review rules for merchant applications.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="amber">
                <ShieldAlert className="h-3.5 w-3.5" />
                {pendingApplications.length} pending
              </Badge>
              <label className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ABB7C0]/35 bg-white/65 px-3 text-sm font-semibold text-[#25425E]">
                <input
                  className="h-4 w-4 accent-[#0E5EC9]"
                  type="checkbox"
                  checked={autoDecisionsEnabled}
                  onChange={(event) => setAutoDecisionsEnabled(event.target.checked)}
                />
                Auto decisions
              </label>
              <Button type="button" variant="secondary" onClick={runAll} disabled={isPending || !pendingApplications.length}>
                <Play className="h-4 w-4" />
                Run Decisions
              </Button>
              <Button type="button" variant="secondary" onClick={addRule} disabled={isPending}>
                <PlusCircle className="h-4 w-4" />
                Add Rule
              </Button>
              <Button type="button" onClick={saveRules} disabled={isPending || !rules.length}>
                <Save className="h-4 w-4" />
                Save Rules
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {rules.map((rule, index) => (
            <div key={rule.id} className="crm-panel rounded-[24px] p-4">
              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.5fr_0.45fr_0.35fr]">
                <Field label="Rule">
                  <Input value={rule.name} onChange={(event) => update(index, "name", event.target.value)} />
                </Field>
                <Field label="Outcome">
                  <Select value={rule.outcome} onChange={(event) => update(index, "outcome", event.target.value as UnderwritingOutcome)}>
                    <option value="approve">Approve</option>
                    <option value="deny">Deny</option>
                    <option value="manual_review">Manual review</option>
                  </Select>
                </Field>
                <Field label="Priority">
                  <Input type="number" min="1" max="999" value={rule.priority} onChange={(event) => update(index, "priority", Number(event.target.value) || 100)} />
                </Field>
                <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-[#25425E]">
                  <input className="h-4 w-4 accent-[#0E5EC9]" type="checkbox" checked={rule.enabled} onChange={(event) => update(index, "enabled", event.target.checked)} />
                  Enabled
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Field label="Min volume">
                  <Input value={rule.minMonthlyVolume} onChange={(event) => update(index, "minMonthlyVolume", event.target.value)} placeholder="10000" />
                </Field>
                <Field label="Max volume">
                  <Input value={rule.maxMonthlyVolume} onChange={(event) => update(index, "maxMonthlyVolume", event.target.value)} />
                </Field>
                <Field label="Min ticket">
                  <Input value={rule.minAverageTicket} onChange={(event) => update(index, "minAverageTicket", event.target.value)} />
                </Field>
                <Field label="Max ticket">
                  <Input value={rule.maxAverageTicket} onChange={(event) => update(index, "maxAverageTicket", event.target.value)} />
                </Field>
                <Field label="Min rate">
                  <Input value={rule.minProposedRate} onChange={(event) => update(index, "minProposedRate", event.target.value)} placeholder="1.5" />
                </Field>
                <Field label="Max rate">
                  <Input value={rule.maxProposedRate} onChange={(event) => update(index, "maxProposedRate", event.target.value)} />
                </Field>
                <Field label="Min docs 0-1">
                  <Input value={rule.minDocumentCompletionRate} onChange={(event) => update(index, "minDocumentCompletionRate", event.target.value)} placeholder="0.8" />
                </Field>
                <Field label="Max docs 0-1">
                  <Input value={rule.maxDocumentCompletionRate} onChange={(event) => update(index, "maxDocumentCompletionRate", event.target.value)} placeholder="0.79" />
                </Field>
              </div>
              <Field label="Risk keywords">
                <Input value={rule.riskKeywords} onChange={(event) => update(index, "riskKeywords", event.target.value)} placeholder="fraud, match list, terminated merchant file" />
              </Field>
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => removeRule(rule)} disabled={isPending || rules.length === 1}>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {!rules.length ? (
            <div className="crm-panel rounded-[24px] p-4 text-sm text-[#25425E]">
              Default underwriting rules will be seeded after the latest Supabase schema is applied.
            </div>
          ) : null}
          {message ? <p className="crm-panel rounded-2xl p-3 text-sm font-semibold text-[#25425E]">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Underwriting Decisions</CardTitle>
          <CardDescription>Audit trail for automated decisions and manual-review routing.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {recentDecisions.map((decision) => {
            const record = data.merchantOnboardingRecords.find((item) => item.id === decision.merchant_onboarding_id);
            return (
              <div key={decision.id} className="crm-panel rounded-[24px] p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0B0F15]">{record?.business_name ?? "Merchant application"}</p>
                    <p className="mt-1 text-[#25425E]/70">{new Date(decision.created_at).toLocaleString()}</p>
                  </div>
                  <Badge tone={decision.decision === "approved" ? "blue" : decision.decision === "declined" ? "rose" : "amber"}>
                    {decision.decision}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-[#25425E]/75">
                  {Array.isArray(decision.reasons.reasons) ? decision.reasons.reasons.join(" ") : "Decision metadata captured."}
                </p>
              </div>
            );
          })}
          {!recentDecisions.length ? (
            <div className="crm-panel rounded-[24px] p-4 text-sm leading-6 text-[#25425E]">
              <BrainCircuit className="mr-2 inline h-4 w-4 text-[#0E5EC9]" />
              Decisions will appear after applications are routed through underwriting automation.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function toDraft(rule: UnderwritingRule): RuleDraft {
  const conditions = rule.conditions;
  return {
    id: rule.id,
    name: rule.name,
    outcome: rule.outcome,
    enabled: rule.enabled,
    priority: rule.priority,
    minMonthlyVolume: stringify(conditions.minMonthlyVolume),
    maxMonthlyVolume: stringify(conditions.maxMonthlyVolume),
    minAverageTicket: stringify(conditions.minAverageTicket),
    maxAverageTicket: stringify(conditions.maxAverageTicket),
    minProposedRate: stringify(conditions.minProposedRate),
    maxProposedRate: stringify(conditions.maxProposedRate),
    minDocumentCompletionRate: stringify(conditions.minDocumentCompletionRate),
    maxDocumentCompletionRate: stringify(conditions.maxDocumentCompletionRate),
    riskKeywords: Array.isArray(conditions.riskKeywords) ? conditions.riskKeywords.join(", ") : "",
  };
}

function fromDraft(rule: RuleDraft) {
  return {
    id: rule.id,
    name: rule.name,
    outcome: rule.outcome,
    enabled: rule.enabled,
    priority: rule.priority,
    conditions: pruneEmpty({
      minMonthlyVolume: numeric(rule.minMonthlyVolume),
      maxMonthlyVolume: numeric(rule.maxMonthlyVolume),
      minAverageTicket: numeric(rule.minAverageTicket),
      maxAverageTicket: numeric(rule.maxAverageTicket),
      minProposedRate: numeric(rule.minProposedRate),
      maxProposedRate: numeric(rule.maxProposedRate),
      minDocumentCompletionRate: numeric(rule.minDocumentCompletionRate),
      maxDocumentCompletionRate: numeric(rule.maxDocumentCompletionRate),
      riskKeywords: rule.riskKeywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    }),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function numeric(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringify(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

function pruneEmpty(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== "";
    }),
  );
}
