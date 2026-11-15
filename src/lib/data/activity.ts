import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import type { Database } from "@/types/database";

type TypedClient = SupabaseClient<Database>;

export interface RecentActivityEvent {
  airport: string;
  destination: string;
  eventType: "became_available" | "sold_out";
  occurredAt: string;
}

export interface RecentActivityPage {
  events: RecentActivityEvent[];
  nextCursor: string | null;
}

/**
 * Backs GET /api/v1/recent — a network-wide feed across every tracked airport,
 * not scoped to one origin. Powers the landing page's live-proof widget
 * (docs/design.md §1) and the multi-airport power-user use case (docs/prd.md §2).
 */
export async function getRecentActivity(
  supabase: TypedClient,
  cursor: string | null,
  limit: number = DEFAULT_PAGE_SIZE,
): Promise<RecentActivityPage> {
  const decoded = decodeCursor(cursor);

  let query = supabase
    .from("route_events")
    .select("id, route_id, event_type, occurred_at")
    .in("event_type", ["became_available", "sold_out"])
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (decoded) {
    query = query.or(
      `occurred_at.lt.${decoded.ts},and(occurred_at.eq.${decoded.ts},id.lt.${decoded.id})`,
    );
  }

  const { data: events, error } = await query;
  if (error) throw error;
  if (!events || events.length === 0) {
    return { events: [], nextCursor: null };
  }

  const routeIds = [...new Set(events.map((event) => event.route_id))];
  const { data: routes, error: routesError } = await supabase
    .from("routes")
    .select("id, origin_airport_code, destination_airport_code, is_active")
    .in("id", routeIds);
  if (routesError) throw routesError;

  const routeById = new Map((routes ?? []).map((route) => [route.id, route]));

  // Routes can be deactivated (docs/database.md, routes.is_active) without their
  // history being deleted — exclude those from the public feed. This can make a
  // page shorter than `limit`; acceptable for an activity feed, not a strict list.
  const visibleEvents: RecentActivityEvent[] = [];
  for (const event of events) {
    const route = routeById.get(event.route_id);
    if (!route || !route.is_active) continue;
    if (event.event_type !== "became_available" && event.event_type !== "sold_out") continue;
    visibleEvents.push({
      airport: route.origin_airport_code,
      destination: route.destination_airport_code,
      eventType: event.event_type,
      occurredAt: event.occurred_at,
    });
  }

  const last = events[events.length - 1];
  const nextCursor =
    events.length === limit && last ? encodeCursor({ ts: last.occurred_at, id: last.id }) : null;

  return { events: visibleEvents, nextCursor };
}
