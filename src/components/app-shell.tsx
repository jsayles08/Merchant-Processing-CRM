import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Gauge,
  HandCoins,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { signOutAction } from "@/app/login/actions";
import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/branding";
import type { Profile } from "@/lib/types";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "#dashboard", active: true },
  { label: "Merchants", icon: BriefcaseBusiness, href: "#merchants" },
  { label: "Leads / Pipeline", icon: Gauge, href: "#leads-pipeline" },
  { label: "Agent Copilot", icon: Bot, href: "#agent-copilot" },
  { label: "Tasks", icon: ClipboardList, href: "#tasks-follow-ups" },
  { label: "Compensation", icon: HandCoins, href: "#compensation" },
  { label: "Teams", icon: UsersRound, href: "#compensation" },
  { label: "Documents", icon: FileText, href: "#merchants" },
  { label: "Reports", icon: BarChart3, href: "#reports" },
  { label: "Admin Settings", icon: Settings, href: "#admin-settings" },
];

export function AppShell({ children, profile }: { children: React.ReactNode; profile?: Profile }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950 lg:block">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              {brand.initials}
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide">{brand.companyName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{brand.productName}</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                    item.active
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              RLS Ready
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Agents see their book, managers see assigned teams, admins see the full company.
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 sm:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white lg:hidden">
                  {brand.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Internal CRM
                  </p>
                  <h1 className="truncate text-xl font-semibold text-slate-950 dark:text-white">
                    Agent production command center
                  </h1>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <HeaderActions />
                {profile ? (
                  <form action={signOutAction}>
                    <Button variant="ghost" type="submit">
                      {profile.full_name}
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
