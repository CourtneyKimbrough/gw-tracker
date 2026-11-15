"use client";

import { useState } from "react";

import { formatAbsoluteTime, formatRelativeTime } from "@/lib/format";
import type { RouteEventType } from "@/types/database";

interface HistoryEvent {
  eventType: RouteEventType;
  occurredAt: string;
}

interface HistoryApiEvent {
  event_type: RouteEventType;
  occurred_at: string;
}

const LABELS: Record<RouteEventType, string> = {
  became_available: "Became available",
  sold_out: "Sold out",
  scrape_error: "Check failed",
};

/**
 * Lazily loaded, separate from the key-facts module above it so that module
 * renders instantly while this — a potentially long, unbounded list —
 * paginates on demand (docs/design.md §4).
 */
export function RouteHistoryList({
  routeSlug,
  initialEvents,
  initialCursor,
}: {
  routeSlug: string;
  initialEvents: HistoryEvent[];
  initialCursor: string | null;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/routes/${routeSlug}/history?cursor=${encodeURIComponent(cursor)}`,
      );
      if (!response.ok) return;
      const data: { events: HistoryApiEvent[]; next_cursor: string | null } = await response.json();
      setEvents((previous) => [
        ...previous,
        ...data.events.map((event) => ({ eventType: event.event_type, occurredAt: event.occurred_at })),
      ]);
      setCursor(data.next_cursor);
    } finally {
      setLoading(false);
    }
  }

  if (events.length === 0) {
    return <p className="text-sm text-foreground-subtle">Not enough history yet.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-px overflow-hidden rounded-lg">
        {events.map((event, index) => (
          <li
            key={`${event.occurredAt}-${index}`}
            className="flex items-center justify-between bg-surface px-4 py-3"
          >
            <span className="text-sm text-foreground-muted">{LABELS[event.eventType]}</span>
            <time
              dateTime={event.occurredAt}
              title={formatAbsoluteTime(event.occurredAt)}
              className="font-mono text-xs text-foreground-subtle"
            >
              {formatRelativeTime(event.occurredAt)}
            </time>
          </li>
        ))}
      </ul>
      {cursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-3 text-sm text-accent hover:underline disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
