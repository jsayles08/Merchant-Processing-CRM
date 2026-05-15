"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const searchEventName = "crm:global-search";

export function HeaderActions({
  canUseCopilot = true,
  canCreateMerchants = true,
  canViewMerchants = true,
}: {
  canUseCopilot?: boolean;
  canCreateMerchants?: boolean;
  canViewMerchants?: boolean;
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function updateSearch(nextQuery: string) {
    setQuery(nextQuery);
    window.dispatchEvent(new CustomEvent(searchEventName, { detail: { query: nextQuery } }));
  }

  function openMerchantSearch() {
    if (!canViewMerchants) return;
    router.push(query.trim() ? `/merchants?search=${encodeURIComponent(query.trim())}` : "/merchants");
  }

  return (
    <>
      {canViewMerchants ? (
      <label className="relative hidden 2xl:block 2xl:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#25425E]/55" />
        <input
          className="h-11 w-full rounded-full border border-[#ABB7C0]/25 bg-white/70 pl-9 pr-3 text-sm font-medium text-[#0B0F15] outline-none shadow-inner transition placeholder:text-[#25425E]/55 focus:border-white focus:bg-white focus:ring-2 focus:ring-[#0E5EC9]/20"
          placeholder="Search merchants, agents, deals"
          value={query}
          onChange={(event) => updateSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              openMerchantSearch();
            }
          }}
        />
      </label>
      ) : null}
      {canUseCopilot ? (
        <Button className="whitespace-nowrap rounded-full" variant="secondary" type="button" onClick={() => router.push("/copilot")}>
          <Bot className="h-4 w-4" />
          Ask Copilot
        </Button>
      ) : null}
      {canCreateMerchants ? (
        <Button className="whitespace-nowrap rounded-full" type="button" onClick={() => router.push("/merchants#add-merchant")}>
          <Plus className="h-4 w-4" />
          Add Merchant
        </Button>
      ) : null}
    </>
  );
}
