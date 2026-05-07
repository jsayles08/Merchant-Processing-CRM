"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { Bell, CheckCheck, CheckCircle2, Clock3, ExternalLink, ListChecks } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Merchant, Notification, NotificationDelivery, Task } from "@/lib/types";

export function NotificationCenter({
  initialNotifications,
  deliveries,
  tasks,
  merchants,
}: {
  initialNotifications: Notification[];
  deliveries: NotificationDelivery[];
  tasks: Task[];
  merchants: Merchant[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const merchantById = useMemo(() => new Map(merchants.map((merchant) => [merchant.id, merchant])), [merchants]);
  const unreadCount = notifications.filter((notification) => notification.status !== "read").length;
  const openTasks = tasks.filter((task) => task.status !== "completed").slice(0, 6);

  function markRead(notificationId: string) {
    startTransition(async () => {
      const result = await markNotificationReadAction(notificationId);
      setMessage(result.message);
      if (result.ok) {
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === notificationId
              ? { ...notification, status: "read", read_at: new Date().toISOString() }
              : notification,
          ),
        );
      }
    });
  }

  function markAllRead() {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      setMessage(result.message);
      if (result.ok) {
        const readAt = new Date().toISOString();
        setNotifications((current) =>
          current.map((notification) => ({ ...notification, status: "read", read_at: notification.read_at ?? readAt })),
        );
      }
    });
  }

  return (
    <section id="notifications" className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
      <Card>
        <CardHeader>
          <CardTitle>Notification Center</CardTitle>
          <CardDescription>Follow-up reminders, delivery outcomes, and operational alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Summary icon={<Bell className="h-4 w-4" />} label="Unread" value={unreadCount.toString()} />
          <Summary icon={<CheckCircle2 className="h-4 w-4" />} label="Total alerts" value={notifications.length.toString()} />
          <Summary icon={<Clock3 className="h-4 w-4" />} label="Delivery logs" value={deliveries.length.toString()} />
          {message ? <p className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">{message}</p> : null}
          <Button className="w-full" type="button" onClick={markAllRead} disabled={isPending || unreadCount === 0}>
            <CheckCheck className="h-4 w-4" />
            Mark All Read
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Alerts</CardTitle>
                <CardDescription>Each notification links back to the CRM record that needs attention.</CardDescription>
              </div>
              <Badge tone={unreadCount ? "amber" : "blue"}>{unreadCount} unread</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!notifications.length ? (
              <EmptyState
                icon={<Bell className="h-5 w-5" />}
                title="No notifications yet"
                description="Upcoming reminders and scheduled job alerts will appear here."
              />
            ) : null}

            {notifications.map((notification) => (
              <article key={notification.id} className="crm-panel rounded-[24px] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={notification.status === "read" ? "slate" : "amber"}>{notification.status}</Badge>
                      <span className="text-xs font-medium text-[#25425E]/60">{new Date(notification.created_at).toLocaleString()}</span>
                    </div>
                    <h3 className="mt-3 text-base font-bold text-[#0B0F15]">{notification.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#25425E]">{notification.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {notification.url ? (
                      <Link
                        href={notification.url}
                        aria-label="Open notification target"
                        title="Open notification target"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ABB7C0]/30 bg-white/65 text-[#0B0F15]"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    ) : null}
                    <Button
                      size="icon"
                      variant="secondary"
                      aria-label="Mark notification read"
                      title="Mark notification read"
                      type="button"
                      onClick={() => markRead(notification.id)}
                      disabled={isPending || notification.status === "read"}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Radar</CardTitle>
            <CardDescription>Open tasks that can generate reminders through the scheduled follow-up job.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!openTasks.length ? (
              <EmptyState
                icon={<ListChecks className="h-5 w-5" />}
                title="No open reminders"
                description="Create task follow-ups to populate reminder alerts."
              />
            ) : null}
            {openTasks.map((task) => {
              const merchant = task.merchant_id ? merchantById.get(task.merchant_id) : null;
              return (
                <Link
                  key={task.id}
                  href={task.merchant_id ? `/tasks?merchant=${task.merchant_id}` : "/tasks"}
                  className="crm-panel block rounded-2xl p-3 transition hover:bg-white/70"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[#0B0F15]">{task.title}</p>
                      <p className="text-sm text-[#25425E]/70">{merchant?.business_name ?? "No merchant"}</p>
                    </div>
                    <Badge tone={task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "slate"}>
                      {new Date(task.due_date).toLocaleDateString()}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {deliveries.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Delivery Log</CardTitle>
              <CardDescription>Email and SMS provider outcomes for reminders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {deliveries.map((delivery) => (
                <div key={delivery.id} className="crm-panel flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-sm">
                  <span className="font-semibold text-[#0B0F15]">
                    {delivery.provider} / {delivery.channel}
                  </span>
                  <span className="text-[#25425E]/70">{delivery.recipient ?? "No recipient"}</span>
                  <Badge tone={delivery.status === "failed" ? "rose" : delivery.status === "sent" ? "blue" : "slate"}>{delivery.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="crm-panel flex items-center justify-between gap-3 rounded-2xl p-3">
      <span className="flex items-center gap-2 text-sm font-medium text-[#25425E]/70">
        {icon}
        {label}
      </span>
      <span className="font-black text-[#0B0F15]">{value}</span>
    </div>
  );
}
