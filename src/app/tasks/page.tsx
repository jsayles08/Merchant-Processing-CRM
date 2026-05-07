import { AppShell } from "@/components/app-shell";
import { TaskManager } from "@/components/tasks/task-manager";
import { getCrmPageContext } from "@/lib/page-context";

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<{ merchant?: string; due?: string }>;
}) {
  const { profile, data } = await getCrmPageContext();
  const params = await searchParams;

  return (
    <AppShell profile={profile} title="Tasks" eyebrow="Follow-up center" activeHref="/tasks">
      <div className="w-full">
        <TaskManager
          data={data}
          currentProfile={profile}
          initialMerchantId={params?.merchant ?? ""}
          initialDueDate={params?.due ?? ""}
        />
      </div>
    </AppShell>
  );
}
