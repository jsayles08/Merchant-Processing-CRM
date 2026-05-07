"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/merchants/merchant-manager";
import { updateMerchantStatusAction } from "@/lib/actions";
import { pipelineStages } from "@/lib/demo-data";
import type { CrmData, Merchant, MerchantStatus } from "@/lib/types";
import { currency, daysBetween, percent } from "@/lib/utils";

export function PipelineBoard({ data }: { data: CrmData }) {
  const [merchants, setMerchants] = useState(data.merchants);
  const [isMounted, setIsMounted] = useState(false);
  const [, startTransition] = useTransition();

  const agentNames = useMemo(
    () =>
      new Map(
        data.agents.map((agent) => {
          const profile = data.profiles.find((item) => item.id === agent.profile_id);
          return [agent.id, profile?.full_name ?? agent.agent_code];
        }),
      ),
    [data.agents, data.profiles],
  );

  function handleDragEnd(event: DragEndEvent) {
    const merchantId = String(event.active.id);
    const stage = event.over?.id as MerchantStatus | undefined;

    if (!stage) return;

    setMerchants((current) =>
      current.map((merchant) =>
        merchant.id === merchantId ? { ...merchant, status: stage, updated_at: new Date().toISOString() } : merchant,
      ),
    );
    startTransition(() => void updateMerchantStatusAction(merchantId, stage));
  }

  useEffect(() => {
    queueMicrotask(() => setIsMounted(true));
  }, []);

  return (
    <section id="leads-pipeline">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Deal Pipeline</CardTitle>
              <CardDescription>Kanban-style acquisition flow with rate flags and follow-up context.</CardDescription>
            </div>
            <Badge tone="blue">Drag-ready board</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isMounted ? (
            <DndContext onDragEnd={handleDragEnd}>
              <div className="grid gap-4 overflow-x-auto pb-2 xl:grid-cols-3 2xl:grid-cols-5">
                {pipelineStages.map((stage) => {
                  const stageMerchants = merchants.filter((merchant) => merchant.status === stage.id);

                  return (
                    <StageColumn key={stage.id} id={stage.id} title={stage.label} merchants={stageMerchants} agentNames={agentNames} />
                  );
                })}
              </div>
            </DndContext>
          ) : (
            <StaticPipeline merchants={merchants} agentNames={agentNames} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StaticPipeline({ merchants, agentNames }: { merchants: Merchant[]; agentNames: Map<string, string> }) {
  return (
    <div className="grid gap-4 overflow-x-auto pb-2 xl:grid-cols-3 2xl:grid-cols-5">
      {pipelineStages.map((stage) => {
        const stageMerchants = merchants.filter((merchant) => merchant.status === stage.id);

        return (
          <div key={stage.id} className="crm-panel min-h-56 min-w-72 rounded-[24px] p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0B0F15]">{stage.label}</h3>
              <Badge>{stageMerchants.length}</Badge>
            </div>
            <div className="space-y-3">
              {stageMerchants.map((merchant) => (
                <article key={merchant.id} className="rounded-[22px] border border-[#ABB7C0]/25 bg-white/80 p-3 shadow-sm">
                  <p className="truncate text-sm font-semibold text-[#0B0F15]">{merchant.business_name}</p>
                  <p className="mt-1 text-xs text-[#25425E]/70">{agentNames.get(merchant.assigned_agent_id) ?? "Unassigned"}</p>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StageColumn({
  id,
  title,
  merchants,
  agentNames,
}: {
  id: MerchantStatus;
  title: string;
  merchants: Merchant[];
  agentNames: Map<string, string>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      id={id}
      className={`min-h-56 min-w-72 rounded-[24px] border p-3 transition ${
        isOver
          ? "border-[#0E5EC9]/45 bg-[#0E5EC9]/8"
          : "border-[#ABB7C0]/25 bg-white/50"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0B0F15]">{title}</h3>
        <Badge>{merchants.length}</Badge>
      </div>
      <div className="space-y-3">
        {merchants.map((merchant) => (
          <MerchantPipelineCard key={merchant.id} merchant={merchant} agentName={agentNames.get(merchant.assigned_agent_id) ?? "Unassigned"} />
        ))}
      </div>
    </div>
  );
}

function MerchantPipelineCard({ merchant, agentName }: { merchant: Merchant; agentName: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: merchant.id });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-[22px] border border-[#ABB7C0]/25 bg-white/82 p-3 shadow-sm transition ${
        isDragging ? "relative z-20 opacity-80 shadow-lg" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#0B0F15]">{merchant.business_name}</p>
          <p className="mt-1 text-xs text-[#25425E]/70">{agentName}</p>
        </div>
        <GripVertical className="h-4 w-4 shrink-0 text-[#ABB7C0]" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MiniMetric label="Volume" value={currency(merchant.monthly_volume_estimate)} />
        <MiniMetric label="Rate" value={percent(merchant.proposed_rate)} />
        <MiniMetric label="Age" value={`${daysBetween(merchant.updated_at)}d`} />
        <MiniMetric label="Ticket" value={currency(merchant.average_ticket)} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusBadge status={merchant.status} />
        {merchant.proposed_rate < 1.5 ? <Badge tone="amber">Below floor</Badge> : null}
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#FDFDFD]/70 p-2">
      <p className="text-[#25425E]/65">{label}</p>
      <p className="mt-1 font-semibold text-[#0B0F15]">{value}</p>
    </div>
  );
}
