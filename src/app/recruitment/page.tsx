import { AppShell } from "@/components/app-shell";
import { RecruitmentWorkspace } from "@/components/recruitment/recruitment-workspace";
import { getCrmPageContext } from "@/lib/page-context";

export default async function RecruitmentPage() {
  const { profile, data } = await getCrmPageContext("recruitment.view");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Recruitment" eyebrow="Agent growth" activeHref="/recruitment">
      <RecruitmentWorkspace data={data} />
    </AppShell>
  );
}
