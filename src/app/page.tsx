import { AppShell } from "@/components/app-shell";
import { AdminSettings } from "@/components/admin/admin-settings";
import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { MerchantManager } from "@/components/merchants/merchant-manager";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { ApprovalQueue } from "@/components/approvals/approval-queue";
import { BusinessReports } from "@/components/reports/business-reports";
import { TaskManager } from "@/components/tasks/task-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSessionContext } from "@/lib/auth";
import { brand } from "@/lib/branding";
import { calculateMonthlyAgentIncome } from "@/lib/compensation";
import { getCrmData } from "@/lib/data";
import { currency, percent } from "@/lib/utils";

export default async function Home() {
  const { supabase, profile } = await getSessionContext();
  const data = await getCrmData(supabase);
  const { data: copilotMessages } = await supabase
    .from("copilot_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(20);
  const currentAgent = data.agents.find((agent) => agent.profile_id === profile.id) ?? data.agents[0];
  const currentAgentId = currentAgent?.id ?? "";
  const agentIncome = calculateMonthlyAgentIncome({
    agentId: currentAgentId,
    residuals: data.residuals,
    teamMembers: data.teamMembers.filter((member) => member.sponsor_agent_id === currentAgentId),
    compensationRule: data.compensationRule,
  });

  return (
    <AppShell profile={profile}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8">
        <DashboardOverview data={data} />
        <MerchantManager data={data} currentProfile={profile} currentAgentId={currentAgentId} />
        <PipelineBoard data={data} />
        <ApprovalQueue deals={data.deals} merchants={data.merchants} agents={data.agents} profiles={data.profiles} currentRole={profile.role} />
        <CopilotPanel initialMessages={copilotMessages ?? []} merchants={data.merchants} />
        <TaskManager data={data} currentProfile={profile} />
        <section id="compensation" className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Compensation Logic</CardTitle>
              <CardDescription>Rule defaults that match the {brand.companyName} model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Rule label="Base residual" value={percent(data.compensationRule.base_residual_percentage, 0)} />
              <Rule label="Minimum rate floor" value={percent(data.compensationRule.minimum_processing_rate)} />
              <Rule label="Override per active recruit" value={percent(data.compensationRule.override_per_active_recruit)} />
              <Rule label="Team override cap" value={percent(data.compensationRule.max_override_per_team)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{currentAgent ? "My Estimate" : "Income Estimate"}</CardTitle>
              <CardDescription>Personal residual plus team override projection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Rule label="Personal residual" value={currency(agentIncome.personalResidualIncome)} />
              <Rule label="Team override" value={currency(agentIncome.teamOverrideEarnings)} />
              <Rule label="Monthly total" value={currency(agentIncome.totalMonthlyIncome)} />
              <Rule label="Annualized" value={currency(agentIncome.annualizedIncomeEstimate)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Team 1 Status</CardTitle>
              <CardDescription>Agent plus four direct recruits per team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.teamMembers.map((member) => {
                const agent = data.agents.find((item) => item.id === member.agent_id);
                const memberProfile = data.profiles.find((item) => item.id === agent?.profile_id);

                return (
                  <div key={member.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3 text-sm dark:border-slate-800">
                    <span className="font-medium">{memberProfile?.full_name}</span>
                    <Badge tone={member.active_recruit_status ? "emerald" : "slate"}>
                      {member.active_recruit_status ? "Active" : "Not active"}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
        <BusinessReports data={data} />
        <AdminSettings data={data} currentProfile={profile} />
      </div>
    </AppShell>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}
