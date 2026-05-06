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
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-3 rounded-md border border-slate-200 bg-white p-2 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
