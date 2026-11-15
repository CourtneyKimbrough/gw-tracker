import type { SupabaseClient } from "@supabase/supabase-js";

import { STALE_DATA_THRESHOLD_MINUTES } from "@/config/constants";
import { bucketForRoute } from "@/lib/bucketing";
import type { Database } from "@/types/database";

type TypedClient = SupabaseClient<Database>;

export interface AirportSummary {
  code: string;
  name: string;
  city: string;
  availableCount: number;
}

export interface AirportMeta {
  code: string;
  name: string;
  city: string;
  timezone: string;
}

export interface DashboardDestination {
  destination: { code: string; city: string };
  firstDetectedAvailableAt: string | null;
  soldOutAt: string | null;
  lastCheckedAt: string | null;
}

export interface AirportDashboard {
  airport: { code: string; name: string; city: string };
  updatedAt: string;
  dataStatus: "fresh" | "stale";
  currentlyAvailable: DashboardDestination[];
  recentlyReleased: DashboardDestination[];
  soldOutToday: DashboardDestination[];
}

/** Backs GET /api/v1/airports and the Airport Selection page (docs/design.md §2). */
export async function listTrackedAirports(supabase: TypedClient): Promise<AirportSummary[]> {
  const { data: airports, error } = await supabase
    .from("airports")
    .select("code, name, city")
    .eq("is_tracked", true)
    .order("city", { ascending: true });
  if (error) throw error;
  if (!airports || airports.length === 0) return [];

  const { data: activeRoutes, error: routesError } = await supabase
    .from("routes")
    .select("id, origin_airport_code")
    .eq("is_active", true);
  if (routesError) throw routesError;

  const routeIds = (activeRoutes ?? []).map((r) => r.id);
  const originByRouteId = new Map((activeRoutes ?? []).map((r) => [r.id, r.origin_airport_code]));

  const { data: states, error: statesError } =
    routeIds.length > 0
      ? await supabase.from("route_states").select("route_id, status").in("route_id", routeIds)
      : { data: [], error: null };
  if (statesError) throw statesError;

  const availableCountByAirport = new Map<string, number>();
  for (const state of states ?? []) {
    if (state.status !== "available") continue;
    const origin = originByRouteId.get(state.route_id);
    if (!origin) continue;
    availableCountByAirport.set(origin, (availableCountByAirport.get(origin) ?? 0) + 1);
  }

  return airports.map((airport) => ({
    code: airport.code,
    name: airport.name,
    city: airport.city,
    availableCount: availableCountByAirport.get(airport.code) ?? 0,
  }));
}

/** Backs GET /api/v1/airports/{code} — lightweight, used for page metadata before the dashboard loads. */
export async function getAirportByCode(
  supabase: TypedClient,
  code: string,
): Promise<AirportMeta | null> {
  const { data, error } = await supabase
    .from("airports")
    .select("code, name, city, timezone")
    .eq("code", code.toUpperCase())
    .eq("is_tracked", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Backs GET /api/v1/airports/{code}/dashboard — the core endpoint. Reads from
 * route_states (the materialized "current truth", docs/database.md), never
 * computes status from raw scrape data.
 */
export async function getAirportDashboard(
  supabase: TypedClient,
  code: string,
): Promise<AirportDashboard | null> {
  const upperCode = code.toUpperCase();

  const airport = await getAirportByCode(supabase, upperCode);
  if (!airport) return null;

  const { data: routes, error: routesError } = await supabase
    .from("routes")
    .select("id, destination_airport_code")
    .eq("origin_airport_code", upperCode)
    .eq("is_active", true);
  if (routesError) throw routesError;

  const now = new Date();

  if (!routes || routes.length === 0) {
    return {
      airport: { code: airport.code, name: airport.name, city: airport.city },
      updatedAt: now.toISOString(),
      dataStatus: "fresh",
      currentlyAvailable: [],
      recentlyReleased: [],
      soldOutToday: [],
    };
  }

  const routeIds = routes.map((r) => r.id);
  const destinationCodes = [...new Set(routes.map((r) => r.destination_airport_code))];

  const [{ data: states, error: statesError }, { data: destinations, error: destinationsError }] =
    await Promise.all([
      supabase
        .from("route_states")
        .select("route_id, status, first_detected_available_at, sold_out_at, last_checked_at")
        .in("route_id", routeIds),
      supabase.from("airports").select("code, city").in("code", destinationCodes),
    ]);
  if (statesError) throw statesError;
  if (destinationsError) throw destinationsError;

  const stateByRouteId = new Map((states ?? []).map((s) => [s.route_id, s]));
  const destinationByCode = new Map((destinations ?? []).map((d) => [d.code, d]));

  const currentlyAvailable: DashboardDestination[] = [];
  const recentlyReleased: DashboardDestination[] = [];
  const soldOutToday: DashboardDestination[] = [];
  let mostRecentCheck: Date | null = null;

  for (const route of routes) {
    const state = stateByRouteId.get(route.id);
    const destination = destinationByCode.get(route.destination_airport_code);
    if (!state || !destination) continue;

    if (state.last_checked_at) {
      const checkedAt = new Date(state.last_checked_at);
      if (!mostRecentCheck || checkedAt > mostRecentCheck) {
        mostRecentCheck = checkedAt;
      }
    }

    const bucket = bucketForRoute({
      status: state.status,
      firstDetectedAvailableAt: state.first_detected_available_at,
      soldOutAt: state.sold_out_at,
      airportTimezone: airport.timezone,
      now,
    });

    const entry: DashboardDestination = {
      destination: { code: destination.code, city: destination.city },
      firstDetectedAvailableAt: state.first_detected_available_at,
      soldOutAt: state.sold_out_at,
      lastCheckedAt: state.last_checked_at,
    };

    if (bucket === "currently_available") currentlyAvailable.push(entry);
    else if (bucket === "recently_released") recentlyReleased.push(entry);
    else if (bucket === "sold_out_today") soldOutToday.push(entry);
  }

  currentlyAvailable.sort((a, b) => a.destination.city.localeCompare(b.destination.city));
  recentlyReleased.sort((a, b) =>
    (b.firstDetectedAvailableAt ?? "").localeCompare(a.firstDetectedAvailableAt ?? ""),
  );
  soldOutToday.sort((a, b) => (b.soldOutAt ?? "").localeCompare(a.soldOutAt ?? ""));

  const dataStatus: "fresh" | "stale" =
    mostRecentCheck &&
    now.getTime() - mostRecentCheck.getTime() <= STALE_DATA_THRESHOLD_MINUTES * 60_000
      ? "fresh"
      : "stale";

  return {
    airport: { code: airport.code, name: airport.name, city: airport.city },
    updatedAt: now.toISOString(),
    dataStatus,
    currentlyAvailable,
    recentlyReleased,
    soldOutToday,
  };
}
