"use client";

import { useState } from "react";

import { RelativeTime } from "@/components/ui/relative-time";
import type { AlertChannel, RouteEventType } from "@/types/database";

interface NotificationItem {
  id: number;
  route: { origin: string; destination: string };
  channel: AlertChannel;
  eventType: RouteEventType | null;
  sentAt: string;
}

interface NotificationApiItem {
  id: number;
  route: { origin: string; destination: string };
  channel: AlertChannel;
  event_type: RouteEventType | null;
  sent_at: string;
}

export function NotificationHistory({
  initialNotifications,
  initialCursor,
}: {
  initialNotifications: NotificationItem[];
  initialCursor: string | null;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/notifications?cursor=${encodeURIComponent(cursor)}`);
      if (!response.ok) return;
      const data: { notifications: NotificationApiItem[]; next_cursor: string | null } =
        await response.json();
      setNotifications((previous) => [
        ...previous,
        ...data.notifications.map((notification) => ({
          id: notification.id,
          route: notification.route,
          channel: notification.channel,
          eventType: notification.event_type,
          sentAt: notification.sent_at,
        })),
      ]);
      setCursor(data.next_cursor);
    } finally {
      setLoading(false);
    }
  }

  if (notifications.length === 0) {
    return <p className="text-sm text-foreground-subtle">No notifications sent yet.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-px overflow-hidden rounded-lg">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className="flex items-center justify-between bg-surface px-4 py-3"
          >
            <span className="font-mono text-sm text-foreground">
              {notification.route.origin} → {notification.route.destination}
            </span>
            <RelativeTime iso={notification.sentAt} />
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
