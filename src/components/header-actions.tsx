"use client";

import { useState } from "react";
import { Bot, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const searchEventName = "crm:global-search";

function scrollToControl(sectionId: string, focusId?: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (focusId) {
    window.setTimeout(() => document.getElementById(focusId)?.focus(), 350);
  }
}

export function HeaderActions() {
  const [query, setQuery] = useState("");

  function updateSearch(nextQuery: string) {
    setQuery(nextQuery);
    window.dispatchEvent(new CustomEvent(searchEventName, { detail: { query: nextQuery } }));
  }

  return (
    <>
      <label className="relative block sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          placeholder="Search merchants, agents, deals"
          value={query}
          onChange={(event) => updateSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              scrollToControl("merchants", "merchant-filter");
            }
          }}
        />
      </label>
      <Button variant="secondary" type="button" onClick={() => scrollToControl("agent-copilot", "copilot-input")}>
        <Bot className="h-4 w-4" />
        Ask Copilot
      </Button>
      <Button type="button" onClick={() => scrollToControl("add-merchant", "merchant-business-name")}>
        <Plus className="h-4 w-4" />
        Add Merchant
      </Button>
    </>
  );
}

