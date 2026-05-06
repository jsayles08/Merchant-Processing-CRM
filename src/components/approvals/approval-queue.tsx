"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, XCircle } from "lucide-react";
import { approveDealAction } from "@/lib/actions";
import type { Agent, Deal, Merchant, Profile, Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, percent } from "@/lib/utils";

export function ApprovalQueue({
  deals,
  merchants,
  agents,
  profiles,
  currentRole,
}: {
  deals: Deal[];
  merchants: Merchant[];
  agents: Agent[];
  profiles: Profile[];
  currentRole: Role;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reviewedDealIds, setReviewedDealIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const pendingDeals = deals.filter((deal) => deal.approval_status === "pending" && !reviewedDealIds.has(deal.id));

  if (!pendingDeals.length) return null;

  function reviewDeal(dealId: string, approvalStatus: "approved" | "denied") {
    startTransition(async () => {
      const result = await approveDealAction(dealId, approvalStatus);
      setMessage(result.message);
      if (result.ok) {
        setReviewedDealIds((current) => new Set(current).add(dealId));
        router.refresh();
      }
    });
  }

  return (
    <section id="approval-requests">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Pricing Approval Queue</CardTitle>
              <CardDescription>Deals below the processing-rate floor require manager or admin review.</CardDescription>
            </div>
            <Badge tone="amber">{pendingDeals.length} pending</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {message ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 lg:col-span-2">
              {message}
            </div>
          ) : null}
          {pendingDeals.map((deal) => {
            const merchant = merchants.find((item) => item.id === deal.merchant_id);
            const agent = agents.find((item) => item.id === deal.agent_id);
            const profile = profiles.find((item) => item.id === agent?.profile_id);

            return (
              <div key={deal.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">{merchant?.business_name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {profile?.full_name ?? "Unassigned"} · {currency(deal.estimated_monthly_volume)} volume
                    </p>
                  </div>
                  <Badge tone="amber">{percent(deal.proposed_rate)} rate</Badge>
                </div>

                {currentRole === "agent" ? (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Waiting for manager approval.</p>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => reviewDeal(deal.id, "approved")}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={isPending}
                      onClick={() => reviewDeal(deal.id, "denied")}
                    >
                      <XCircle className="h-4 w-4" />
                      Deny
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
