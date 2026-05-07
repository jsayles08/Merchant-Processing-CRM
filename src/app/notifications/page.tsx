import { AppShell } from "@/components/app-shell";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { getCrmPageContext } from "@/lib/page-context";
import type { Notification, NotificationDelivery } from "@/lib/types";

export default async function NotificationsPage() {
  const { supabase, profile, data } = await getCrmPageContext();
  const [{ data: notifications }, { data: deliveries }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<Notification[]>(),
    supabase
      .from("notification_deliveries")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<NotificationDelivery[]>(),
  ]);

  return (
    <AppShell profile={profile} title="Notifications" eyebrow="Alert center" activeHref="/notifications">
      <div className="w-full">
        <NotificationCenter
          initialNotifications={notifications ?? []}
          deliveries={deliveries ?? []}
          tasks={data.tasks}
          merchants={data.merchants}
        />
      </div>
    </AppShell>
  );
}
