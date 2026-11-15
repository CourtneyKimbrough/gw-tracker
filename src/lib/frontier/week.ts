import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchMarketDirectory, searchScheduleDay, type ScheduleHit } from "@/lib/frontier/search";
import type { FlightOffer } from "@/lib/frontier/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "chicago-week.json");
const BOARD_PATH = path.join(DATA_DIR, "chicago-board.json");
const ORIGINS = ["ORD", "MDW"] as const;
const DOMESTIC_TERRITORIES = new Set(["SJU", "BQN", "PSE"]);

type OriginCode = (typeof ORIGINS)[number];

type FlightRecord = {
  id: string;
  origin: OriginCode;
  destination: string;
  departLabel: string;
  flightNumbers: string[];
  stops: number;
  stopCities: string[];
  duration: string;
  dates: string[];
  /** Dates inside the GoWild window when this flight was operating and we checked it. */
  windowDates: string[];
  goWildDates: string[];
  prices: Record<string, number>;
};

type Watch = {
  firstOpenAt: string;
  soldOutAt: string | null;
};

type Store = {
  updatedAt: string;
  warning: string | null;
  scanned: Record<string, string[]>;
  flights: Record<string, FlightRecord>;
  watches: Record<string, Watch>;
  cities: CitySeed[];
};

type CitySeed = {
  origin: OriginCode;
  code: string;
  city: string;
  international: boolean;
};

export type WeekCell = {
  date: string;
  state: "unchecked" | "absent" | "flies" | "gowild" | "none" | "soldout";
  price: number | null;
  selloutMinutes: number | null;
};

export type WeekFlight = {
  id: string;
  origin: OriginCode;
  originName: string;
  destination: string;
  destinationCity: string;
  international: boolean;
  flightNumbers: string[];
  departLabel: string;
  stops: number;
  stopCities: string[];
  duration: string;
  daysSeen: number;
  daysChecked: number;
  regular: boolean;
  goWildSeen: number;
  goWildChecks: number;
  selloutMinutes: number | null;
  cells: WeekCell[];
};

export type WeekCity = {
  origin: OriginCode;
  originName: string;
  code: string;
  city: string;
  international: boolean;
  checkedDays: number;
  status: "unchecked" | "no_service" | "served";
  flightCount: number;
  regularCount: number;
  goWildFlights: number;
  selloutMinutes: number | null;
};

export type WeekView = {
  updatedAt: string | null;
  today: string;
  days: Array<{ date: string; label: string }>;
  flights: WeekFlight[];
  cities: WeekCity[];
  warning: string | null;
};

let inFlight: Promise<WeekView> | null = null;

export async function loadWeekView(): Promise<WeekView> {
  const store = (await readStore()) ?? (await seedStore());
  return toView(store);
}

export function scanWeekCatalog(options?: { maxSearches?: number }): Promise<WeekView> {
  if (!inFlight) {
    inFlight = runScan(options?.maxSearches).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runScan(maxSearches?: number): Promise<WeekView> {
  const store = (await readStore()) ?? (await seedStore());
  const today = chicagoDate();
  const days = Array.from({ length: 7 }, (_, offset) => addDays(today, offset));
  let consecutiveErrors = 0;
  let searches = 0;

  for (const city of store.cities) {
    const key = routeKey(city.origin, city.code);
    const done = new Set(store.scanned[key] ?? []);
    const remaining = days.filter((date) => !done.has(date));
    if (remaining.length === 0) continue;

    for (const date of remaining) {
      if (maxSearches != null && searches >= maxSearches) {
        store.updatedAt = new Date().toISOString();
        if (consecutiveErrors === 0) store.warning = null;
        await writeStore(store);
        console.info(`Stopped after ${searches} Frontier searches.`);
        return toView(store);
      }
      searches += 1;
      const result = await searchScheduleDay(city.origin, city.code, date);
      if (result.status === "error") {
        consecutiveErrors += 1;
        store.warning = result.error ?? "Frontier stopped answering.";
        if (consecutiveErrors >= 3) {
          store.updatedAt = new Date().toISOString();
          store.warning = "Frontier cut off the catalog. Refresh later to keep going from where this left off.";
          await writeStore(store);
          return toView(store);
        }
        await new Promise((resolve) => setTimeout(resolve, 900));
        continue;
      }
      consecutiveErrors = 0;
      applyDay(store, city, date, result.flights, result.outOfWindow, new Date().toISOString(), true);
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    store.updatedAt = new Date().toISOString();
    store.warning = null;
    await writeStore(store);
    console.info(`Cataloged ${city.origin}-${city.code}`);
  }

  store.updatedAt = new Date().toISOString();
  store.warning = null;
  await writeStore(store);
  return toView(store);
}

function applyDay(
  store: Store,
  city: CitySeed,
  date: string,
  hits: ScheduleHit[],
  outOfWindow: boolean,
  now: string,
  markScanned: boolean,
) {
  if (markScanned) {
    const key = routeKey(city.origin, city.code);
    const scanned = store.scanned[key] ?? [];
    if (!scanned.includes(date)) scanned.push(date);
    store.scanned[key] = scanned;
  }

  const seen = new Set<string>();
  const inWindow = !outOfWindow && goWildWindowOpen(date, chicagoDate(), city.international);
  for (const hit of hits) {
    const id = flightId(city.origin, city.code, hit.flightNumbers, hit.departLabel);
    seen.add(id);
    const record = store.flights[id] ?? {
      id,
      origin: city.origin,
      destination: city.code,
      departLabel: hit.departLabel,
      flightNumbers: hit.flightNumbers,
      stops: hit.stops,
      stopCities: hit.stopCities,
      duration: hit.duration,
      dates: [],
      windowDates: [],
      goWildDates: [],
      prices: {},
    };
    record.prices ??= {};
    if (!record.dates.includes(date)) record.dates.push(date);
    if (inWindow && !record.windowDates.includes(date)) record.windowDates.push(date);
    if (hit.goWild && !record.goWildDates.includes(date)) record.goWildDates.push(date);
    if (hit.price != null) record.prices[date] = hit.price;
    if (hit.goWild) {
      const watchKey = `${id}|${date}`;
      if (!store.watches[watchKey]) store.watches[watchKey] = { firstOpenAt: now, soldOutAt: null };
    }
    store.flights[id] = record;
  }

  for (const [watchKey, watch] of Object.entries(store.watches)) {
    if (watch.soldOutAt || !watchKey.endsWith(`|${date}`)) continue;
    const id = watchKey.slice(0, -(date.length + 1));
    const record = store.flights[id];
    if (!record || record.origin !== city.origin || record.destination !== city.code) continue;
    if (!record.dates.includes(date) || record.goWildDates.includes(date)) continue;
    watch.soldOutAt = now;
  }
}

async function seedStore(): Promise<Store> {
  const directory = await fetchMarketDirectory();
  const cities: CitySeed[] = [];
  for (const origin of ORIGINS) {
    for (const code of directory.from.get(origin) ?? []) {
      const station = directory.stations.get(code);
      cities.push({
        origin,
        code,
        city: station?.name ?? code,
        international: isInternational(station?.countryCode ?? "", code),
      });
    }
  }
  cities.sort((a, b) => a.city.localeCompare(b.city) || a.origin.localeCompare(b.origin));

  const store: Store = {
    updatedAt: new Date().toISOString(),
    warning: null,
    scanned: {},
    flights: {},
    watches: {},
    cities,
  };
  await ingestSavedBoard(store);
  await writeStore(store);
  return store;
}

async function ingestSavedBoard(store: Store) {
  try {
    const raw = await readFile(BOARD_PATH, "utf8");
    const board = JSON.parse(raw) as { flights?: FlightOffer[] };
    const now = new Date().toISOString();
    for (const flight of board.flights ?? []) {
      if (flight.origin !== "ORD" && flight.origin !== "MDW") continue;
      const city = store.cities.find((item) => item.origin === flight.origin && item.code === flight.destination);
      if (!city) continue;
      applyDay(
        store,
        city,
        flight.date,
        [
          {
            flightNumbers: flight.flightNumbers,
            departLabel: flight.departLabel,
            stops: flight.stops,
            stopCities: flight.stopCities,
            duration: flight.duration,
            goWild: true,
            price: flight.price,
          },
        ],
        false,
        now,
        false,
      );
    }
  } catch {
    // No earlier check to seed from.
  }
}

function toView(store: Store): WeekView {
  const today = chicagoDate();
  const dayDates = Array.from({ length: 7 }, (_, offset) => addDays(today, offset));
  const days = dayDates.map((date) => ({ date, label: formatDayLabel(date) }));

  const flights: WeekFlight[] = Object.values(store.flights)
    .map((record) => toFlight(store, record, dayDates, today))
    .filter((flight) => flight.daysSeen > 0)
    .sort(
      (a, b) =>
        departMinutes(a.departLabel) - departMinutes(b.departLabel) ||
        a.destinationCity.localeCompare(b.destinationCity),
    );

  const cities: WeekCity[] = store.cities.map((city) => {
    const own = flights.filter((flight) => flight.origin === city.origin && flight.destination === city.code);
    const checkedDays = (store.scanned[routeKey(city.origin, city.code)] ?? []).length;
    const samples = own.map((flight) => flight.selloutMinutes).filter((minutes): minutes is number => minutes != null);
    return {
      origin: city.origin,
      originName: originName(city.origin),
      code: city.code,
      city: city.city,
      international: city.international,
      checkedDays,
      status: own.length > 0 ? "served" : checkedDays === 0 ? "unchecked" : "no_service",
      flightCount: own.length,
      regularCount: own.filter((flight) => flight.regular).length,
      goWildFlights: own.filter((flight) => flight.goWildSeen > 0).length,
      selloutMinutes: median(samples),
    };
  });

  return {
    updatedAt: store.updatedAt,
    today,
    days,
    flights,
    cities,
    warning: store.warning,
  };
}

function toFlight(store: Store, record: FlightRecord, dayDates: string[], today: string): WeekFlight {
  const city = store.cities.find((item) => item.origin === record.origin && item.code === record.destination);
  const international = city?.international ?? false;
  const checked = new Set(store.scanned[routeKey(record.origin, record.destination)] ?? []);
  const daysChecked = dayDates.filter((date) => checked.has(date)).length;
  const seen = new Set(record.dates);
  const daysSeen = dayDates.filter((date) => seen.has(date)).length;
  const samples = selloutSamples(store, record.id);
  const cells: WeekCell[] = dayDates.map((date) => {
    if (!checked.has(date) && !seen.has(date)) {
      return { date, state: "unchecked", price: null, selloutMinutes: null };
    }
    if (!seen.has(date)) return { date, state: "absent", price: null, selloutMinutes: null };
    const watch = store.watches[`${record.id}|${date}`];
    const minutes = watch?.soldOutAt ? minutesBetween(watch.firstOpenAt, watch.soldOutAt) : null;
    if (minutes != null) return { date, state: "soldout", price: null, selloutMinutes: minutes };
    if (record.goWildDates.includes(date)) {
      return { date, state: "gowild", price: record.prices?.[date] ?? null, selloutMinutes: null };
    }
    if (goWildWindowOpen(date, today, international) && record.windowDates.includes(date)) {
      return { date, state: "none", price: null, selloutMinutes: null };
    }
    return { date, state: "flies", price: null, selloutMinutes: null };
  });

  return {
    id: record.id,
    origin: record.origin,
    originName: originName(record.origin),
    destination: record.destination,
    destinationCity: city?.city ?? record.destination,
    international,
    flightNumbers: record.flightNumbers,
    departLabel: record.departLabel,
    stops: record.stops,
    stopCities: record.stopCities,
    duration: record.duration,
    daysSeen,
    daysChecked: Math.max(daysChecked, daysSeen),
    regular: daysSeen >= 5 || (daysChecked >= 3 && daysSeen / daysChecked >= 0.8),
    goWildSeen: record.goWildDates.length,
    goWildChecks: record.windowDates.length,
    selloutMinutes: median(samples),
    cells,
  };
}

function selloutSamples(store: Store, id: string): number[] {
  const samples: number[] = [];
  for (const [key, watch] of Object.entries(store.watches)) {
    if (!watch.soldOutAt || !key.startsWith(`${id}|`)) continue;
    samples.push(minutesBetween(watch.firstOpenAt, watch.soldOutAt));
  }
  return samples;
}

function minutesBetween(start: string, end: string): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const left = sorted[mid - 1];
  const right = sorted[mid];
  if (right == null) return null;
  if (sorted.length % 2 === 1 || left == null) return right;
  return Math.round((left + right) / 2);
}

function departMinutes(label: string): number {
  const match = label.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  if (hours === 12) hours = 0;
  if ((match[3] ?? "").toUpperCase() === "PM") hours += 12;
  return hours * 60 + minutes;
}

function flightId(origin: string, destination: string, flightNumbers: string[], departLabel: string): string {
  return `${origin}|${destination}|${flightNumbers.join("+")}|${departLabel}`;
}

function routeKey(origin: string, destination: string): string {
  return `${origin}-${destination}`;
}

function originName(origin: OriginCode): string {
  return origin === "ORD" ? "O'Hare" : "Midway";
}

function isInternational(countryCode: string, station: string): boolean {
  if (DOMESTIC_TERRITORIES.has(station) || countryCode === "PR" || countryCode === "US") return false;
  return countryCode !== "";
}

function goWildWindowOpen(date: string, today: string, international: boolean): boolean {
  const offset = daysBetween(today, date);
  if (offset < 0) return false;
  return international ? offset <= 10 : offset <= 1;
}

function daysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  if (
    startYear == null ||
    startMonth == null ||
    startDay == null ||
    endYear == null ||
    endMonth == null ||
    endDay == null
  ) {
    return 0;
  }
  const from = Date.UTC(startYear, startMonth - 1, startDay);
  const to = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((to - from) / 86400000);
}

function chicagoDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year == null || month == null || day == null) return isoDate;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year == null || month == null || day == null) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function readStore(): Promise<Store | null> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as Store;
  } catch {
    return null;
  }
}

async function writeStore(store: Store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store));
}
