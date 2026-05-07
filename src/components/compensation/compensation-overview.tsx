import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { brand } from "@/lib/branding";
import { calculateMonthlyAgentIncome } from "@/lib/compensation";
import type { CrmData } from "@/lib/types";
import { currency, percent } from "@/lib/utils";

export function CompensationOverview({
  data,
  currentAgentId,
}: {
  data: CrmData;
  currentAgentId: string;
}) {
  const currentAgent = data.agents.find((agent) => agent.id === currentAgentId);
  const agentIncome = calculateMonthlyAgentIncome({
    agentId: currentAgentId,
    residuals: data.residuals,
    teamMembers: data.teamMembers.filter((member) => member.sponsor_agent_id === currentAgentId),
    compensationRule: data.compensationRule,
  });

  return (
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
          <CardTitle>Team Status</CardTitle>
          <CardDescription>Agent plus direct recruited team members.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.teamMembers.map((member) => {
            const agent = data.agents.find((item) => item.id === member.agent_id);
            const memberProfile = data.profiles.find((item) => item.id === agent?.profile_id);

            return (
              <div key={member.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm">
                <span className="font-medium">{memberProfile?.full_name}</span>
                <Badge tone={member.active_recruit_status ? "emerald" : "slate"}>
                  {member.active_recruit_status ? "Active" : "Not active"}
                </Badge>
              </div>
            );
          })}
          {!data.teamMembers.length ? <p className="text-sm text-slate-500">No team members assigned yet.</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}
