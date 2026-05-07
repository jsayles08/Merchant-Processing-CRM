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
            <p className="text-sm text-[#25425E]/70">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-[#0B0F15]">{value}</p>
            <p className="mt-2 text-xs text-[#D57D25]">{delta}</p>
          </div>
          <div className="rounded-2xl border border-[#ABB7C0]/25 bg-white/70 p-2 text-[#0E5EC9]">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
