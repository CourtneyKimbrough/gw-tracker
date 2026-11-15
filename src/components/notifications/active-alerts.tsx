"use client";

import { useState } from "react";

import type { AlertChannel } from "@/types/database";

interface AlertItem {
  id: number;
  route: { origin: string; destination: string };
  channel: AlertChannel;
}

/** Management/review surface only — alerts are created from the Route Detail page, not here (docs/design.md §6). */
export function ActiveAlerts({ initialAlerts }: { initialAlerts: AlertItem[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [removingId, setRemovingId] = useState<number | null>(null);

  async function handleRemove(id: number) {
    setRemovingId(id);
    try {
      const response = await fetch(`/api/v1/alerts/${id}`, { method: "DELETE" });
      if (response.ok || response.status === 404) {
        setAlerts((previous) => previous.filter((alert) => alert.id !== id));
      }
    } finally {
      setRemovingId(null);
    }
  }

  if (alerts.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle">
        You&apos;re not watching any routes yet. Tap &quot;Notify me&quot; on a sold-out route&apos;s
        page to get started.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-px overflow-hidden rounded-lg">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex items-center justify-between bg-surface px-4 py-3">
          <span className="font-mono text-sm text-foreground">
            {alert.route.origin} → {alert.route.destination}
          </span>
          <button
            type="button"
            onClick={() => handleRemove(alert.id)}
            disabled={removingId === alert.id}
            className="text-xs text-foreground-muted hover:text-danger disabled:opacity-50"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
