"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const heartbeatMs = 60_000;

export function PresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/login") || pathname?.startsWith("/setup") || pathname?.startsWith("/auth")) return;

    let cancelled = false;
    const sendHeartbeat = (status: "online" | "away" | "offline") => {
      if (cancelled) return;
      fetch("/api/activity/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, path: pathname ?? "/" }),
        keepalive: status === "offline",
      }).catch(() => {
        // Presence should never interrupt the CRM experience.
      });
    };

    sendHeartbeat(document.visibilityState === "hidden" ? "away" : "online");
    const interval = window.setInterval(() => {
      sendHeartbeat(document.visibilityState === "hidden" ? "away" : "online");
    }, heartbeatMs);

    const handleVisibility = () => sendHeartbeat(document.visibilityState === "hidden" ? "away" : "online");
    const handlePageHide = () => sendHeartbeat("offline");

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [pathname]);

  return null;
}
