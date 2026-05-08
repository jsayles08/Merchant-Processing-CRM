import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="crm-panel crm-animate-pop flex min-h-48 flex-col items-center justify-center rounded-[28px] border-dashed p-8 text-center">
      <div className="mb-3 rounded-2xl border border-[#ABB7C0]/35 bg-white p-2 text-[#25425E] transition-transform duration-200 hover:rotate-3 hover:scale-105">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-[#0B0F15]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[#25425E]/70">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
