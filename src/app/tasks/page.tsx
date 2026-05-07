import { AppShell } from "@/components/app-shell";
import { TaskManager } from "@/components/tasks/task-manager";
import { getCrmPageContext } from "@/lib/page-context";

export default async function TasksPage() {
  const { profile, data } = await getCrmPageContext();

  return (
    <AppShell profile={profile} title="Tasks" eyebrow="Follow-up center" activeHref="/tasks">
      <div className="mx-auto max-w-[1500px]">
        <TaskManager data={data} currentProfile={profile} />
      </div>
    </AppShell>
  );
}
