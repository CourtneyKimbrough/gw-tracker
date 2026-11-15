import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import type { AlertChannel, Database, RouteEventType } from "@/types/database";

type TypedClient = SupabaseClient<Database>;

export interface AlertSummary {
  id: number;
  route: { origin: string; destination: string };
  channel: AlertChannel;
  createdAt: string;
}

/** Backs GET /api/v1/alerts — the Notifications page's "Active alerts" list. */
export async function listAlertsForUser(
  supabase: TypedClient,
  userId: string,
): Promise<AlertSummary[]> {
  const { data: alerts, error } = await supabase
    .from("alert_subscriptions")
    .select("id, route_id, channel, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!alerts || alerts.length === 0) return [];

  const routeIds = [...new Set(alerts.map((alert) => alert.route_id))];
  const { data: routes, error: routesError } = await supabase
    .from("routes")
    .select("id, origin_airport_code, destination_airport_code")
    .in("id", routeIds);
  if (routesError) throw routesError;
  const routeById = new Map((routes ?? []).map((route) => [route.id, route]));

  return alerts.flatMap((alert) => {
    const route = routeById.get(alert.route_id);
    if (!route) return [];
    return [
      {
        id: alert.id,
        route: { origin: route.origin_airport_code, destination: route.destination_airport_code },
        channel: alert.channel,
        createdAt: alert.created_at,
      },
    ];
  });
}

/**
 * Backs POST /api/v1/alerts — the "Notify me" toggle on the Route Detail page
 * (docs/design.md §4/§6). Idempotent: a duplicate (user, route, channel)
 * request returns the existing subscription instead of erroring (docs/api.md).
 */
export async function createAlert(
  supabase: TypedClient,
  userId: string,
  routeId: number,
  channel: AlertChannel,
): Promise<AlertSummary> {
  const { data: existing, error: existingError } = await supabase
    .from("alert_subscriptions")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("route_id", routeId)
    .eq("channel", channel)
    .maybeSingle();
  if (existingError) throw existingError;

  const record =
    existing ??
    (await (async () => {
      const { data: inserted, error: insertError } = await supabase
        .from("alert_subscriptions")
        .insert({ user_id: userId, route_id: routeId, channel })
        .select("id, created_at")
        .single();
      if (insertError) throw insertError;
      return inserted;
    })());

  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("origin_airport_code, destination_airport_code")
    .eq("id", routeId)
    .single();
  if (routeError) throw routeError;

  return {
    id: record.id,
    route: { origin: route.origin_airport_code, destination: route.destination_airport_code },
    channel,
    createdAt: record.created_at,
  };
}

/** Looks up a single subscription, used to render the Route Detail page's "Notify me" toggle state. */
export async function getAlertId(
  supabase: TypedClient,
  userId: string,
  routeId: number,
  channel: AlertChannel,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("alert_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("route_id", routeId)
    .eq("channel", channel)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Backs DELETE /api/v1/alerts/{id}. Returns false if no matching row belonged to this user. */
export async function deleteAlert(
  supabase: TypedClient,
  userId: string,
  alertId: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("alert_subscriptions")
    .delete()
    .eq("id", alertId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export interface NotificationSummary {
  id: number;
  route: { origin: string; destination: string };
  channel: AlertChannel;
  eventType: RouteEventType | null;
  sentAt: string;
}

export interface NotificationPage {
  notifications: NotificationSummary[];
  nextCursor: string | null;
}

/** Backs GET /api/v1/notifications — the Notifications page's "History" section. */
export async function listNotificationsForUser(
  supabase: TypedClient,
  userId: string,
  cursor: string | null,
  limit: number = DEFAULT_PAGE_SIZE,
): Promise<NotificationPage> {
  const decoded = decodeCursor(cursor);

  let query = supabase
    .from("notification_log")
    .select("id, route_id, route_event_id, channel, sent_at")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (decoded) {
    query = query.or(`sent_at.lt.${decoded.ts},and(sent_at.eq.${decoded.ts},id.lt.${decoded.id})`);
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows || rows.length === 0) {
    return { notifications: [], nextCursor: null };
  }

  const routeIds = [...new Set(rows.map((row) => row.route_id))];
  const eventIds = [...new Set(rows.map((row) => row.route_event_id).filter((id): id is number => id !== null))];

  const [{ data: routes, error: routesError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("routes").select("id, origin_airport_code, destination_airport_code").in("id", routeIds),
    eventIds.length > 0
      ? supabase.from("route_events").select("id, event_type").in("id", eventIds)
      : Promise.resolve({
          data: [] as { id: number; event_type: RouteEventType }[],
          error: null,
        }),
  ]);
  if (routesError) throw routesError;
  if (eventsError) throw eventsError;

  const routeById = new Map((routes ?? []).map((route) => [route.id, route]));
  const eventById = new Map((events ?? []).map((event) => [event.id, event]));

  const notifications: NotificationSummary[] = rows.flatMap((row) => {
    const route = routeById.get(row.route_id);
    if (!route) return [];
    const event = row.route_event_id !== null ? eventById.get(row.route_event_id) : undefined;
    return [
      {
        id: row.id,
        route: { origin: route.origin_airport_code, destination: route.destination_airport_code },
        channel: row.channel,
        eventType: event?.event_type ?? null,
        sentAt: row.sent_at,
      },
    ];
  });

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last ? encodeCursor({ ts: last.sent_at, id: last.id }) : null;

  return { notifications, nextCursor };
}
