import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "slate" | "emerald" | "amber" | "rose" | "blue" | "violet";

const tones: Record<BadgeTone, string> = {
  slate: "border-[#ABB7C0]/35 bg-white/70 text-[#25425E]",
  emerald: "border-[#0E5EC9]/20 bg-[#0E5EC9]/10 text-[#0E5EC9]",
  amber: "border-[#E9D7A1]/70 bg-[#E9D7A1]/55 text-[#6F461D]",
  rose: "border-[#D57D25]/25 bg-[#D57D25]/12 text-[#9F4E16]",
  blue: "border-[#0E5EC9]/20 bg-[#0E5EC9]/10 text-[#0E5EC9]",
  violet: "border-[#ABB7C0]/45 bg-[#25425E]/10 text-[#25425E]",
};

export function Badge({
  className,
  tone = "slate",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-transform duration-150 hover:-translate-y-0.5",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
