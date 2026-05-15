import { AppShell } from "@/components/app-shell";
import { ApprovalQueue } from "@/components/approvals/approval-queue";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { getCrmPageContext } from "@/lib/page-context";

export default async function OpportunitiesPage() {
  const { profile, data } = await getCrmPageContext("opportunities.view");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Opportunities" eyebrow="Sales pipeline" activeHref="/opportunities">
      <div className="flex w-full flex-col gap-6">
        <PipelineBoard data={data} />
        <ApprovalQueue deals={data.deals} merchants={data.merchants} agents={data.agents} profiles={data.profiles} currentRole={profile.role} />
      </div>
    </AppShell>
  );
}
