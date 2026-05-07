import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness, ClipboardList, Gauge } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCrmPageContext } from "@/lib/page-context";
import { currency } from "@/lib/utils";

export default async function Home() {
  const { profile, data } = await getCrmPageContext();
  const pendingTasks = data.tasks.filter((task) => task.status !== "completed").length;
  const openPipeline = data.deals
    .filter((deal) => !["processing", "lost", "inactive"].includes(deal.stage))
    .reduce((sum, deal) => sum + deal.estimated_monthly_volume, 0);

  return (
    <AppShell profile={profile} title="Dashboard" eyebrow="MerchantDesk" activeHref="/">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QuickLink href="/merchants" icon={<BriefcaseBusiness className="h-4 w-4" />} label="Merchants" value={`${data.merchants.length} accounts`} />
          <QuickLink href="/opportunities" icon={<Gauge className="h-4 w-4" />} label="Opportunities" value={currency(openPipeline)} />
          <QuickLink href="/tasks" icon={<ClipboardList className="h-4 w-4" />} label="Tasks" value={`${pendingTasks} open`} />
          <QuickLink href="/copilot" icon={<Bot className="h-4 w-4" />} label="Copilot" value="Assistant ready" />
        </div>
        <DashboardOverview data={data} />
      </div>
    </AppShell>
  );
}

function QuickLink({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <Badge tone="blue">
              {icon}
              {label}
            </Badge>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="text-lg">{value}</CardTitle>
          <CardDescription>Open workspace</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
