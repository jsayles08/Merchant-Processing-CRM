import Link from "next/link";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Database,
  Gauge,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Star,
  Upload,
} from "lucide-react";
import { signOutAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand-logo";
import { HeaderActions } from "@/components/header-actions";
import { brand } from "@/lib/branding";
import type { Profile } from "@/lib/types";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

const topNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Merchants", icon: BriefcaseBusiness, href: "/merchants" },
  { label: "Opportunities", icon: Gauge, href: "/opportunities" },
  { label: "Tasks", icon: ClipboardList, href: "/tasks" },
  { label: "Reports", icon: BarChart3, href: "/reports" },
];

const railItems: NavItem[] = [
  { label: "Search merchants", icon: Search, href: "/merchants" },
  { label: "Opportunities", icon: Share2, href: "/opportunities" },
  { label: "Documents", icon: Upload, href: "/documents" },
  { label: "Reports", icon: Star, href: "/reports" },
  { label: "Add merchant", icon: Plus, href: "/merchants#add-merchant" },
  { label: "Compensation", icon: HandCoins, href: "/compensation" },
  { label: "Data room", icon: Database, href: "/documents" },
  { label: "Tasks", icon: CalendarDays, href: "/tasks" },
  { label: "Copilot", icon: Send, href: "/copilot" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

const headerIconClassName =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ABB7C0]/25 bg-white/70 text-[#0B0F15] shadow-inner ring-1 ring-white/50 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E5EC9]/20";

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
    <div className="crm-shell-bg min-h-screen text-[#0B0F15]">
      <div className="min-h-screen w-full overflow-hidden">
        <header className="sticky top-0 z-30 border-b border-white/65 bg-[#FDFDFD]/72 px-4 py-4 backdrop-blur-2xl sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/" className="group flex min-w-[8.5rem] items-center" aria-label={`${brand.productName} home`}>
                <BrandLogo className="h-16 w-auto object-contain" priority />
              </Link>

              <nav className="hidden items-center gap-3 xl:flex">
                {topNavItems.map((item) => {
                  const active = activeHref === item.href || (item.href !== "/" && activeHref.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                      active
                        ? "bg-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
                          : "text-[#25425E] hover:bg-white/70 hover:text-[#0B0F15]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <HeaderActions />
              <div className="flex items-center gap-2">
                <Link href="/messages" aria-label="Messages" title="Messages" className={headerIconClassName}>
                  <Mail className="h-4 w-4" />
                </Link>
                <Link href="/notifications" aria-label="Notifications" title="Notifications" className={headerIconClassName}>
                  <Bell className="h-4 w-4" />
                </Link>
                {profile ? (
                  <div className="flex items-center gap-2 rounded-full bg-white/45 p-1.5 shadow-inner ring-1 ring-black/5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9D7A1] text-sm font-black text-[#0B0F15]">
                      {profile.full_name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <form action={signOutAction}>
                      <button type="submit" aria-label="Sign out" title="Sign out" className={headerIconClassName}>
                        <LogOut className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between xl:hidden">
            <div>
              <p className="text-xs font-semibold uppercase text-[#25425E]/70">{eyebrow}</p>
              <h1 className="text-2xl font-black text-[#0B0F15]">{title}</h1>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {topNavItems.map((item) => {
                const active = activeHref === item.href || (item.href !== "/" && activeHref.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                      active ? "bg-black text-white" : "bg-white/65 text-[#25425E]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <div className="relative">
          <aside className="fixed left-5 top-[8.5rem] z-20 hidden max-h-[calc(100vh-10rem)] overflow-visible rounded-full bg-[#0B0F15]/95 p-2 shadow-[0_20px_45px_rgba(0,0,0,0.28)] backdrop-blur xl:flex xl:flex-col xl:items-start xl:gap-2">
            {railItems.map((item) => {
              const Icon = item.icon;
              const active = activeHref === item.href || (item.href !== "/" && activeHref.startsWith(item.href));
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className={`group/rail-link relative flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9D7A1]/75 ${
                    active
                      ? "bg-[#E9D7A1] text-[#0B0F15]"
                      : "text-white/90 hover:bg-white hover:text-[#0B0F15] focus-visible:bg-white focus-visible:text-[#0B0F15]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span
                    className={`pointer-events-none absolute left-[calc(100%+0.7rem)] top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold opacity-0 shadow-lg ring-1 ring-black/5 transition-opacity duration-150 ease-out group-hover/rail-link:opacity-100 group-focus-visible/rail-link:opacity-100 ${
                      active ? "bg-[#E9D7A1] text-[#0B0F15]" : "bg-white text-[#0B0F15]"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </aside>

          <main className="min-h-[calc(100vh-8rem)] px-4 py-6 sm:px-6 lg:px-8 xl:pl-28">
            <div className="hidden pb-6 xl:block">
              <p className="text-xs font-semibold uppercase text-[#25425E]/70">{eyebrow}</p>
              <h1 className="mt-1 text-4xl font-black text-[#0B0F15]">{title}</h1>
            </div>
            {children}
          </main>
        </div>

        <div className="hidden border-t border-white/65 bg-[#FDFDFD]/48 px-8 py-3 text-xs font-medium text-[#25425E]/70 xl:flex xl:items-center xl:justify-between">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0E5EC9]" />
            Production health and role-aware access enabled
          </span>
          <span>{brand.supportEmail}</span>
        </div>
      </div>
    </div>
  );
}
