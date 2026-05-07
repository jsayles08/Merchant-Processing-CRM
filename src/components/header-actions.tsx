"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const searchEventName = "crm:global-search";

export function HeaderActions() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function updateSearch(nextQuery: string) {
    setQuery(nextQuery);
    window.dispatchEvent(new CustomEvent(searchEventName, { detail: { query: nextQuery } }));
  }

  function openMerchantSearch() {
    router.push(query.trim() ? `/merchants?search=${encodeURIComponent(query.trim())}` : "/merchants");
  }

  return (
    <>
      <label className="relative block sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
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
      <Button variant="secondary" type="button" onClick={() => router.push("/copilot")}>
        <Bot className="h-4 w-4" />
        Ask Copilot
      </Button>
      <Button type="button" onClick={() => router.push("/merchants#add-merchant")}>
        <Plus className="h-4 w-4" />
        Add Merchant
      </Button>
    </>
  );
}
