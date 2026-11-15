import type { FlightOffer, RouteDayResult } from "@/lib/frontier/types";
import { airportName, destinationCity } from "@/lib/frontier/routes";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type FrontierFlight = {
  legs?: FrontierLeg[];
  duration?: string;
  stopCount?: number;
  stops?: Array<{ station?: string }> | null;
  goWildFare?: number;
  isGoWildFareEnabled?: boolean;
  goWildFareSeatsRemaining?: number | null;
  isNextDayArrival?: boolean;
};

type FrontierLeg = {
  departureStation?: string;
  arrivalStation?: string;
  departureDate?: string;
  arrivalDate?: string;
  departureDateFormatted?: string;
  arrivalDateFormatted?: string;
  flightNumber?: number;
  carrierCode?: string;
};

type FrontierPayload = {
  isGoWildOutOfRange?: boolean;
  journeys?: Array<{ flights?: FrontierFlight[] | null }> | null;
};

export type StationInfo = {
  code: string;
  name: string;
  countryCode: string;
};

export type ScheduleHit = {
  flightNumbers: string[];
  departLabel: string;
  stops: number;
  stopCities: string[];
  duration: string;
  goWild: boolean;
  price: number | null;
};

export type ScheduleDay = {
  origin: string;
  destination: string;
  date: string;
  status: "ok" | "no_service" | "error";
  outOfWindow: boolean;
  flights: ScheduleHit[];
  error?: string;
};

export async function fetchMarketDirectory(): Promise<{
  stations: Map<string, StationInfo>;
  from: Map<string, string[]>;
}> {
  const response = await fetch("https://booking.flyfrontier.com/Resource/GetMarkets", {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Frontier markets request failed (${response.status})`);
  }
  const body = (await response.json()) as {
    marketDetails?: Array<{ stationCode?: string; stationName?: string; countryCode?: string }>;
    markets?: Array<{ fromStation?: string; toStations?: string[] }>;
  };
  const stations = new Map<string, StationInfo>();
  for (const station of body.marketDetails ?? []) {
    if (!station.stationCode) continue;
    stations.set(station.stationCode, {
      code: station.stationCode,
      name: station.stationName ?? station.stationCode,
      countryCode: station.countryCode ?? "",
    });
  }
  const from = new Map<string, string[]>();
  for (const market of body.markets ?? []) {
    if (!market.fromStation) continue;
    from.set(market.fromStation, market.toStations ?? []);
  }
  return { stations, from };
}

export async function searchScheduleDay(origin: string, destination: string, date: string): Promise<ScheduleDay> {
  try {
    const html = await fetchBookingPage(bookingUrl(origin, destination, date));
    const payload = parseFlightData(html);
    if (!payload) {
      return {
        origin,
        destination,
        date,
        status: "error",
        outOfWindow: false,
        flights: [],
        error: "Frontier's booking page didn't include flight data.",
      };
    }
    const listed = payload.journeys?.[0]?.flights ?? [];
    if (listed.length === 0) {
      return { origin, destination, date, status: "no_service", outOfWindow: false, flights: [] };
    }
    const outOfWindow = Boolean(payload.isGoWildOutOfRange);
    return {
      origin,
      destination,
      date,
      status: "ok",
      outOfWindow,
      flights: uniqueItineraries(listed, outOfWindow),
    };
  } catch (error) {
    return {
      origin,
      destination,
      date,
      status: "error",
      outOfWindow: false,
      flights: [],
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

export async function fetchMarkets(): Promise<Map<string, Set<string>>> {
  const response = await fetch("https://booking.flyfrontier.com/Resource/GetMarkets", {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Frontier markets request failed (${response.status})`);
  }
  const body = (await response.json()) as {
    markets?: Array<{ fromStation?: string; toStations?: string[] }>;
  };
  const byOrigin = new Map<string, Set<string>>();
  for (const market of body.markets ?? []) {
    if (!market.fromStation) continue;
    byOrigin.set(market.fromStation, new Set(market.toStations ?? []));
  }
  return byOrigin;
}

export async function searchRouteDay(
  origin: string,
  destination: string,
  date: string,
): Promise<RouteDayResult> {
  const bookUrl = bookingUrl(origin, destination, date);
  try {
    const html = await fetchBookingPage(bookUrl);
    const payload = parseFlightData(html);
    if (!payload) {
      return {
        origin,
        destination,
        date,
        status: "error",
        lowestPrice: null,
        flights: [],
        error: "Frontier's booking page didn't include flight data.",
      };
    }

    const listed = payload.journeys?.[0]?.flights ?? [];
    if (listed.length === 0) {
      return { origin, destination, date, status: "no_service", lowestPrice: null, flights: [] };
    }

    const flights = payload.isGoWildOutOfRange ? [] : uniqueGoWildFlights(listed, origin, destination, date);
    if (flights.length === 0) {
      return { origin, destination, date, status: "closed", lowestPrice: null, flights: [] };
    }

    return {
      origin,
      destination,
      date,
      status: "open",
      lowestPrice: Math.min(...flights.map((flight) => flight.price)),
      flights,
    };
  } catch (error) {
    return {
      origin,
      destination,
      date,
      status: "error",
      lowestPrice: null,
      flights: [],
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function uniqueItineraries(listed: FrontierFlight[], outOfWindow: boolean): ScheduleHit[] {
  const seen = new Set<string>();
  const hits: ScheduleHit[] = [];
  for (const flight of listed) {
    const legs = flight.legs ?? [];
    const first = legs[0];
    if (!first) continue;
    const key = legs.map((leg) => `${leg.flightNumber}-${leg.departureDate}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const price = flight.goWildFare ?? -1;
    const goWild = !outOfWindow && Boolean(flight.isGoWildFareEnabled) && price > 0;
    hits.push({
      flightNumbers: legs.map((leg) => `${leg.carrierCode ?? "F9"} ${leg.flightNumber ?? ""}`.trim()),
      departLabel: first.departureDateFormatted ?? "",
      stops: flight.stopCount ?? Math.max(0, legs.length - 1),
      stopCities: (flight.stops ?? []).map((stop) => stop.station).filter((code): code is string => Boolean(code)),
      duration: flight.duration ?? "",
      goWild,
      price: goWild ? price : null,
    });
  }
  return hits;
}

function uniqueGoWildFlights(
  listed: FrontierFlight[],
  origin: string,
  destination: string,
  date: string,
): FlightOffer[] {
  const seen = new Set<string>();
  const flights: FlightOffer[] = [];
  for (const flight of listed) {
    const price = flight.goWildFare ?? -1;
    if (!flight.isGoWildFareEnabled || price <= 0) continue;
    const legs = flight.legs ?? [];
    if (legs.length === 0) continue;
    const key = legs.map((leg) => `${leg.flightNumber}-${leg.departureDate}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const first = legs[0];
    const last = legs[legs.length - 1];
    if (!first || !last) continue;
    flights.push({
      origin,
      originName: airportName(origin),
      destination,
      destinationCity: destinationCity(destination),
      date,
      departsAt: first.departureDate ?? date,
      arrivesAt: last.arrivalDate ?? date,
      departLabel: first.departureDateFormatted ?? "",
      arriveLabel: last.arrivalDateFormatted ?? "",
      arrivesNextDay: Boolean(flight.isNextDayArrival) || (last.arrivalDate ?? "").slice(0, 10) !== date,
      stops: flight.stopCount ?? Math.max(0, legs.length - 1),
      stopCities: (flight.stops ?? []).map((stop) => stop.station).filter((code): code is string => Boolean(code)),
      duration: flight.duration ?? "",
      price,
      seats: typeof flight.goWildFareSeatsRemaining === "number" ? flight.goWildFareSeatsRemaining : null,
      flightNumbers: legs.map((leg) => `${leg.carrierCode ?? "F9"} ${leg.flightNumber ?? ""}`.trim()),
      bookUrl: bookingUrl(origin, destination, date),
    });
  }
  return flights;
}

function bookingUrl(origin: string, destination: string, date: string): string {
  const params = new URLSearchParams({
    o1: origin,
    d1: destination,
    dd1: date,
    ADT: "1",
    mon: "true",
    r: "false",
  });
  return `https://booking.flyfrontier.com/Flight/InternalSelect?${params.toString()}`;
}

async function fetchBookingPage(url: string): Promise<string> {
  const jar = new Map<string, string>();
  let current = url;
  for (let hop = 0; hop < 5; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": USER_AGENT,
        referer: "https://www.flyfrontier.com/",
        cookie: [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
      },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Frontier redirected without a location.");
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`Frontier booking page failed (${response.status})`);
    }
    return response.text();
  }
  throw new Error("Frontier redirected too many times.");
}

function parseFlightData(html: string): FrontierPayload | null {
  const marker = "FlightData = '";
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const from = start + marker.length;
  const end = html.indexOf("';", from);
  if (end < 0) return null;
  const raw = html
    .slice(from, end)
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
  return JSON.parse(raw) as FrontierPayload;
}
