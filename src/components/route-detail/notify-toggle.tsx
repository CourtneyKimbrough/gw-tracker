"use client";

import { useState } from "react";

interface NotifyToggleProps {
  routeSlug: string;
  initialAlertId: number | null;
}

/**
 * Lives directly on the Route Detail page, not the Notifications page — alerts
 * are created at the moment of intent (docs/design.md §6). Channel is fixed to
 * "email" here: it's the one channel this app can fulfil end-to-end with no
 * extra infrastructure (push would need VAPID keys + a service worker + a
 * push-subscription table that doesn't exist yet — building that UI without
 * the backing infrastructure would be exactly the placeholder code we're
 * avoiding).
 */
export function NotifyToggle({ routeSlug, initialAlertId }: NotifyToggleProps) {
  const [alertId, setAlertId] = useState(initialAlertId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setPending(true);
    setError(null);
    try {
      if (alertId) {
        const response = await fetch(`/api/v1/alerts/${alertId}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) {
          throw new Error("Failed to remove alert.");
        }
        setAlertId(null);
        return;
      }

      const response = await fetch("/api/v1/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: routeSlug, channel: "email" }),
      });

      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/routes/${routeSlug}`)}`;
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to create alert.");
      }

      const data: { id: number } = await response.json();
      setAlertId(data.id);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
          alertId
            ? "bg-surface text-foreground hover:bg-surface-hover"
            : "bg-accent text-accent-foreground hover:opacity-90"
        }`}
      >
        {alertId ? "Notifying when available" : "Notify me when available"}
      </button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
