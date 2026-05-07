import Link from "next/link";
import {
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Gauge,
  HandCoins,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { signOutAction } from "@/app/login/actions";
import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/branding";
import type { Profile } from "@/lib/types";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/" },
      { label: "Tasks", icon: ClipboardList, href: "/tasks" },
      { label: "Agent Copilot", icon: Bot, href: "/copilot" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Merchants", icon: BriefcaseBusiness, href: "/merchants" },
      { label: "Opportunities", icon: Gauge, href: "/opportunities" },
      { label: "Documents", icon: FileText, href: "/documents" },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Reports", icon: BarChart3, href: "/reports" },
      { label: "Compensation", icon: HandCoins, href: "/compensation" },
      { label: "Settings", icon: Settings, href: "/settings" },
    ],
  },
];

export function AppShell({
  children,
  profile,
  title = "Dashboard",
  eyebrow = "MerchantDesk",
  activeHref = "/",
}: {
  children: React.ReactNode;
  profile?: Profile;
  title?: string;
  eyebrow?: string;
  activeHref?: string;
}) {
  return (
    <div className="min-h-screen bg-[#eef1f4] p-3 text-slate-950 sm:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1800px] overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:min-h-[calc(100vh-2rem)]">
        <aside className="hidden w-72 shrink-0 flex-col bg-[#171a33] text-slate-200 lg:flex">
          <div className="flex items-center gap-3 px-5 py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white shadow-lg shadow-indigo-950/30">
              {brand.initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-white">{brand.productName}</p>
              <p className="truncate text-xs text-slate-400">{brand.companyName}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 text-xs font-medium text-slate-400">{group.label}</p>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      activeHref === item.href || (item.href !== "/" && activeHref.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          active
                            ? "bg-slate-700/80 text-white shadow-inner"
                            : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Secure workspace
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Role-aware access, private merchant files, and production health checks are enabled.
              </p>
            </div>
            {profile ? (
              <div className="flex items-center gap-3 rounded-xl bg-black/15 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-900">
                  {profile.full_name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{profile.full_name}</p>
                  <p className="truncate text-xs text-slate-400">{profile.email}</p>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white lg:hidden">
                  {brand.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{eyebrow}</p>
                  <h1 className="truncate text-xl font-bold text-slate-950 sm:text-2xl">{title}</h1>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <HeaderActions />
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="icon" type="button" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="icon" type="button" aria-label="Support">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                  {profile ? (
                    <form action={signOutAction}>
                      <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-x-hidden bg-white px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
