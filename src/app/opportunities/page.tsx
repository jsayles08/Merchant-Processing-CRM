import { AppShell } from "@/components/app-shell";
import { ApprovalQueue } from "@/components/approvals/approval-queue";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { getCrmPageContext } from "@/lib/page-context";

export default async function OpportunitiesPage() {
  const { profile, data } = await getCrmPageContext();

  return (
    <AppShell profile={profile} title="Opportunities" eyebrow="Sales pipeline" activeHref="/opportunities">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <PipelineBoard data={data} />
        <ApprovalQueue deals={data.deals} merchants={data.merchants} agents={data.agents} profiles={data.profiles} currentRole={profile.role} />
      </div>
    </AppShell>
  );
}
