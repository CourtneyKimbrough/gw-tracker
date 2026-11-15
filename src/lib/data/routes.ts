import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PAGE_SIZE, MIN_EVENTS_FOR_CONFIDENT_AVERAGE } from "@/config/constants";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import type { Database, RouteEventType, RouteStatus } from "@/types/database";

type TypedClient = SupabaseClient<Database>;

export interface RouteSlug {
  origin: string;
  destination: string;
}

const ROUTE_SLUG_PATTERN = /^([A-Z]{3})-([A-Z]{3})$/;

/** Parses the "ORD-DEN" URL slug used throughout docs/api.md and docs/design.md. */
export function parseRouteSlug(slug: string): RouteSlug | null {
  const match = ROUTE_SLUG_PATTERN.exec(slug.toUpperCase());
  if (!match) return null;
  const [, origin, destination] = match;
  if (!origin || !destination) return null;
  return { origin, destination };
}

export async function resolveRouteId(
  supabase: TypedClient,
  origin: string,
  destination: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("routes")
    .select("id")
    .eq("origin_airport_code", origin)
    .eq("destination_airport_code", destination)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export interface RouteDetail {
  route: RouteSlug;
  status: RouteStatus;
  firstDetectedAvailableAt: string | null;
  soldOutAt: string | null;
  lastCheckedAt: string | null;
  seatsRemaining: number | null;
  averageSelloutMinutes: number | null;
  statsConfidence: "low" | "high";
}

/** Backs GET /api/v1/routes/{slug} — the Route Detail page's key-facts module. */
export async function getRouteDetail(supabase: TypedClient, slug: string): Promise<RouteDetail | null> {
  const parsed = parseRouteSlug(slug);
  if (!parsed) return null;

  const routeId = await resolveRouteId(supabase, parsed.origin, parsed.destination);
  if (routeId === null) return null;

  const { data: state, error: stateError } = await supabase
    .from("route_states")
    .select("status, first_detected_available_at, sold_out_at, last_checked_at, seats_remaining")
    .eq("route_id", routeId)
    .maybeSingle();
  if (stateError) throw stateError;
  if (!state) return null;

  const { data: statsRows, error: statsError } = await supabase
    .from("daily_route_stats")
    .select("sellout_duration_minutes")
    .eq("route_id", routeId)
    .not("sellout_duration_minutes", "is", null);
  if (statsError) throw statsError;

  const durations = (statsRows ?? [])
    .map((row) => row.sellout_duration_minutes)
    .filter((minutes): minutes is number => minutes !== null);

  const averageSelloutMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((sum, minutes) => sum + minutes, 0) / durations.length)
      : null;

  return {
    route: parsed,
    status: state.status,
    firstDetectedAvailableAt: state.first_detected_available_at,
    soldOutAt: state.sold_out_at,
    lastCheckedAt: state.last_checked_at,
    seatsRemaining: state.seats_remaining,
    averageSelloutMinutes,
    statsConfidence: durations.length >= MIN_EVENTS_FOR_CONFIDENT_AVERAGE ? "high" : "low",
  };
}

export interface RouteHistoryEvent {
  eventType: RouteEventType;
  occurredAt: string;
}

export interface RouteHistoryPage {
  events: RouteHistoryEvent[];
  nextCursor: string | null;
}

/**
 * Backs GET /api/v1/routes/{slug}/history. Deliberately separate from
 * getRouteDetail so the stat module renders instantly while history loads as
 * its own, potentially-long, lazily-fetched list (docs/design.md §4).
 */
export async function getRouteHistory(
  supabase: TypedClient,
  slug: string,
  cursor: string | null,
  limit: number = DEFAULT_PAGE_SIZE,
): Promise<RouteHistoryPage | null> {
  const parsed = parseRouteSlug(slug);
  if (!parsed) return null;

  const routeId = await resolveRouteId(supabase, parsed.origin, parsed.destination);
  if (routeId === null) return null;

  const decoded = decodeCursor(cursor);

  let query = supabase
    .from("route_events")
    .select("id, event_type, occurred_at")
    .eq("route_id", routeId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (decoded) {
    query = query.or(
      `occurred_at.lt.${decoded.ts},and(occurred_at.eq.${decoded.ts},id.lt.${decoded.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last ? encodeCursor({ ts: last.occurred_at, id: last.id }) : null;

  return {
    events: rows.map((row) => ({ eventType: row.event_type, occurredAt: row.occurred_at })),
    nextCursor,
  };
}
