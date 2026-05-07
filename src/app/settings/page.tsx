import { AppShell } from "@/components/app-shell";
import { AdminSettings } from "@/components/admin/admin-settings";
import { getCrmPageContext } from "@/lib/page-context";

export default async function SettingsPage() {
  const { profile, data } = await getCrmPageContext();

  return (
    <AppShell profile={profile} title="Settings" eyebrow="Admin workspace" activeHref="/settings">
      <div className="w-full">
        <AdminSettings data={data} currentProfile={profile} />
      </div>
    </AppShell>
  );
}
