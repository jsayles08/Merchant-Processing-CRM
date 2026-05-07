"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="crm-shell-bg flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D57D25] text-white">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle>Something Needs Attention</CardTitle>
          <CardDescription>The CRM hit an unexpected issue while loading this view.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-[#25425E]">
            Try again. If this continues, capture the time, page, and user action so an admin can review logs.
          </p>
          <Button onClick={reset}>
            <RefreshCcw className="h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
