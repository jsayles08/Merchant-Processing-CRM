"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteMerchantAction } from "@/lib/actions";

export function DeleteMerchantButton({
  merchantId,
  merchantName,
  label = "Delete merchant",
  redirectTo,
  onDeleted,
  compact = false,
}: {
  merchantId: string;
  merchantName: string;
  label?: string;
  redirectTo?: string;
  onDeleted?: (merchantId: string, message: string) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    setErrorMessage("");
    startTransition(async () => {
      const result = await deleteMerchantAction(merchantId);

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      onDeleted?.(merchantId, result.message);
      setIsOpen(false);

      if (redirectTo) {
        router.push(redirectTo);
      }

      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size={compact ? "sm" : "md"}
        className={compact ? "px-3" : undefined}
        onClick={() => setIsOpen(true)}
        disabled={isPending}
        aria-label={`Delete ${merchantName}`}
      >
        <Trash2 className="h-4 w-4" />
        {isPending ? "Deleting..." : label}
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F15]/35 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-merchant-${merchantId}`}
            className="w-full max-w-md rounded-[28px] border border-white/70 bg-[#FDFDFD] p-5 shadow-[0_24px_70px_rgba(11,15,21,0.22)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D57D25]/12 text-[#D57D25]">
              <Trash2 className="h-5 w-5" />
            </div>
            <h2 id={`delete-merchant-${merchantId}`} className="mt-4 text-xl font-black text-[#0B0F15]">
              Delete merchant?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#25425E]">
              This will permanently remove <span className="font-semibold text-[#0B0F15]">{merchantName}</span>, including
              the profile, deal, tasks, updates, documents, and residual records.
            </p>
            {errorMessage ? (
              <p className="mt-3 rounded-2xl border border-[#D57D25]/25 bg-[#D57D25]/10 p-3 text-sm font-medium text-[#9F4E16]">
                {errorMessage}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={confirmDelete} disabled={isPending}>
                <Trash2 className="h-4 w-4" />
                {isPending ? "Deleting..." : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
