import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{delta}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-emerald-700 dark:border-slate-800 dark:bg-slate-900 dark:text-emerald-300">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
