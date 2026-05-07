"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { importResidualReportAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";

export function ResidualImporter() {
  const [isPending, startTransition] = useTransition();
  const [processorName, setProcessorName] = useState("Processor report");
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [csvText, setCsvText] = useState("");
  const [message, setMessage] = useState("");

  function importResiduals() {
    startTransition(async () => {
      const result = await importResidualReportAction({
        processor_name: processorName,
        statement_month: `${statementMonth}-01`,
        csv_text: csvText,
      });
      setMessage(result.message);
      if (result.ok) setCsvText("");
    });
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setCsvText(await file.text());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Residual Import</CardTitle>
        <CardDescription>Import processor CSV rows by merchant ID or exact business name.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Processor">
            <Input value={processorName} onChange={(event) => setProcessorName(event.target.value)} />
          </Field>
          <Field label="Statement month">
            <Input type="month" value={statementMonth} onChange={(event) => setStatementMonth(event.target.value)} />
          </Field>
        </div>
        <Field label="CSV file">
          <Input type="file" accept=".csv,text/csv" onChange={(event) => readFile(event.target.files?.[0])} />
        </Field>
        <Field label="CSV contents">
          <Textarea
            className="min-h-40 font-mono text-xs"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder="business_name,processing_volume,net_residual&#10;Acme LLC,125000,1850"
          />
        </Field>
        {message ? <p className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">{message}</p> : null}
        <Button className="w-full" onClick={importResiduals} disabled={isPending || !csvText.trim()}>
          <Upload className="h-4 w-4" />
          Import Residuals
        </Button>
      </CardContent>
    </Card>
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
