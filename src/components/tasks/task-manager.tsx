"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle2, ClipboardList, Plus } from "lucide-react";
import { createTaskAction, updateTaskStatusAction } from "@/lib/actions";
import type { CrmData, Priority, Profile, Task, TaskStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { titleCase } from "@/lib/utils";

type TaskForm = {
  title: string;
  description: string;
  assigned_to: string;
  merchant_id: string;
  due_date: string;
  priority: Priority;
};

function defaultDueDate(initialDueDate = "") {
  if (initialDueDate) {
    const parsed = new Date(initialDueDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 16);
    }
  }

  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
}

export function TaskManager({
  data,
  currentProfile,
  initialMerchantId = "",
  initialDueDate = "",
}: {
  data: CrmData;
  currentProfile: Profile;
  initialMerchantId?: string;
  initialDueDate?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [tasks, setTasks] = useState(data.tasks);
  const assigneeOptions = data.profiles.filter((profile) => profile.status === "active");
  const initialMerchant = data.merchants.some((merchant) => merchant.id === initialMerchantId) ? initialMerchantId : "";
  const [form, setForm] = useState<TaskForm>({
    title: "",
    description: "",
    assigned_to: currentProfile.id,
    merchant_id: initialMerchant,
    due_date: defaultDueDate(initialDueDate),
    priority: "medium",
  });

  function update<TKey extends keyof TaskForm>(key: TKey, value: TaskForm[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function createTask() {
    startTransition(async () => {
      const result = await createTaskAction(form);
      setMessage(result.message);
      if (result.ok) {
        if (result.data) {
          setTasks((current) => [result.data as Task, ...current]);
        }
        setForm((current) => ({ ...current, title: "", description: "", merchant_id: initialMerchant, due_date: defaultDueDate(initialDueDate) }));
        router.refresh();
      }
    });
  }

  function updateStatus(taskId: string, status: TaskStatus) {
    startTransition(async () => {
      const result = await updateTaskStatusAction(taskId, status);
      setMessage(result.message);
      if (result.ok) {
        setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));
        router.refresh();
      }
    });
  }

  const openTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed").slice(0, 5);

  return (
    <section id="tasks-follow-ups" className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <Card>
        <CardHeader>
          <CardTitle>Create Task</CardTitle>
          <CardDescription>Assign follow-ups, underwriting work, document requests, and manager coaching.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Title">
            <Input
              id="task-title"
              name="title"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Call merchant for statements"
            />
          </Field>
          <Field label="Description">
            <Textarea
              id="task-description"
              name="description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="What needs to happen?"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Assigned to">
              <Select id="task-assigned-to" name="assigned_to" value={form.assigned_to} onChange={(event) => update("assigned_to", event.target.value)}>
                {assigneeOptions.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Merchant">
              <Select id="task-merchant" name="merchant_id" value={form.merchant_id} onChange={(event) => update("merchant_id", event.target.value)}>
                <option value="">No merchant</option>
                {data.merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.business_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date">
              <Input id="task-due-date" name="due_date" type="datetime-local" value={form.due_date} onChange={(event) => update("due_date", event.target.value)} />
            </Field>
            <Field label="Priority">
              <Select id="task-priority" name="priority" value={form.priority} onChange={(event) => update("priority", event.target.value as Priority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
          </div>
          {message ? <p className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]">{message}</p> : null}
          <Button className="w-full" onClick={createTask} disabled={isPending}>
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Task Board</CardTitle>
              <CardDescription>Operational follow-ups across agents and merchants.</CardDescription>
            </div>
            <Badge tone="blue">{openTasks.length} open</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!openTasks.length && !completedTasks.length ? (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title="No tasks yet"
              description="Create the first follow-up, onboarding, or underwriting task for this team."
            />
          ) : null}
          {openTasks.map((task) => {
            const merchant = data.merchants.find((item) => item.id === task.merchant_id);
            const assignee = data.profiles.find((item) => item.id === task.assigned_to);
            return (
              <div key={task.id} className="crm-panel grid gap-3 rounded-[24px] p-4 md:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#0B0F15]">{task.title}</p>
                    <Badge tone={task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "slate"}>{task.priority}</Badge>
                    <Badge tone={task.status === "overdue" ? "rose" : "blue"}>{task.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[#25425E]/70">
                    {assignee?.full_name ?? "Unassigned"} · {merchant?.business_name ?? "No merchant"} · {new Date(task.due_date).toLocaleString()}
                  </p>
                  {task.description ? <p className="mt-2 text-sm text-[#25425E]">{task.description}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" disabled={isPending} onClick={() => updateStatus(task.id, "open")}>
                    <CalendarCheck className="h-4 w-4" />
                    Open
                  </Button>
                  <Button size="sm" disabled={isPending} onClick={() => updateStatus(task.id, "completed")}>
                    <CheckCircle2 className="h-4 w-4" />
                    Done
                  </Button>
                </div>
              </div>
            );
          })}

          {completedTasks.length ? (
            <div className="pt-2">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Recently completed</p>
              {completedTasks.map((task) => (
                <div key={task.id} className="crm-panel rounded-2xl p-3 text-sm text-[#25425E]/70">
                  {task.title} · {titleCase(task.status)}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
