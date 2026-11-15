"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Gives the dashboard a "live" feel via Next's built-in soft-refresh rather
 * than adding a WebSocket/SSE dependency — the underlying data only changes
 * as fast as the scraper polls, so this is sufficient (docs/architecture.md §2).
 */
export function DashboardAutoRefresh({ intervalMs = 25_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
