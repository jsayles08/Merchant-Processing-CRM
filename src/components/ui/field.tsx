import { type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold text-[#25425E]", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-full border border-[#ABB7C0]/35 bg-white/75 px-3 text-sm text-[#0B0F15] outline-none transition placeholder:text-[#25425E]/45 focus:border-[#0E5EC9] focus:ring-2 focus:ring-[#0E5EC9]/15",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-[22px] border border-[#ABB7C0]/35 bg-white/75 px-3 py-2 text-sm text-[#0B0F15] outline-none transition placeholder:text-[#25425E]/45 focus:border-[#0E5EC9] focus:ring-2 focus:ring-[#0E5EC9]/15",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-full border border-[#ABB7C0]/35 bg-white/75 px-3 text-sm text-[#0B0F15] outline-none transition focus:border-[#0E5EC9] focus:ring-2 focus:ring-[#0E5EC9]/15",
        className,
      )}
      {...props}
    />
  );
}
