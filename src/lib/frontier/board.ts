import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CHICAGO_AIRPORTS, CHICAGO_DESTINATIONS, airportName, destinationCity } from "@/lib/frontier/routes";
import { fetchMarkets, mapPool, searchRouteDay } from "@/lib/frontier/search";
import type { BoardView, HistoryDay, RouteDayResult, RouteScore } from "@/lib/frontier/types";

const DATA_DIR = path.join(process.cwd(), "data");
const BOARD_PATH = path.join(DATA_DIR, "chicago-board.json");
const HISTORY_PATH = path.join(DATA_DIR, "chicago-history.json");
const HISTORY_LIMIT_DAYS = 45;

let inFlight: Promise<BoardView> | null = null;

export async function loadCachedBoard(): Promise<BoardView | null> {
  try {
    const raw = await readFile(BOARD_PATH, "utf8");
    return JSON.parse(raw) as BoardView;
  } catch {
    return null;
  }
}

export function scanChicagoBoard(): Promise<BoardView> {
  if (!inFlight) {
    inFlight = runScan().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runScan(): Promise<BoardView> {
  const chicagoToday = chicagoDate();
  const domesticDates = [chicagoToday, addDays(chicagoToday, 1)];
  const internationalDates = Array.from({ length: 11 }, (_, offset) => addDays(chicagoToday, offset));

  let markets: Map<string, Set<string>> | null = null;
  try {
    markets = await fetchMarkets();
  } catch (error) {
    console.warn("Frontier market list failed, searching the Chicago list anyway.", error);
  }

  const jobs: Array<{ origin: string; destination: string; date: string }> = [];
  for (const airport of CHICAGO_AIRPORTS) {
    const served = markets?.get(airport.code);
    for (const destination of CHICAGO_DESTINATIONS) {
      if (served && !served.has(destination.code)) continue;
      const dates = destination.international ? internationalDates : domesticDates;
      for (const date of dates) {
        jobs.push({ origin: airport.code, destination: destination.code, date });
      }
    }
  }

  console.info(`Checking ${jobs.length} Chicago GoWild searches…`);
  let finished = 0;
  const results = await mapPool(jobs, 1, async (job) => {
    const result = await searchRouteDay(job.origin, job.destination, job.date);
    await new Promise((resolve) => setTimeout(resolve, 800));
    finished += 1;
    if (finished % 10 === 0 || finished === jobs.length) {
      console.info(`Frontier checks ${finished}/${jobs.length}`);
    }
    return result;
  });

  const errors = results.filter((result) => result.status === "error").length;
  const previous = await loadCachedBoard();
  if (previous && results.length > 0 && errors / results.length > 0.5) {
    return {
      ...previous,
      warning: "Frontier didn't return a fresh check. Showing the last good one.",
    };
  }

  const board = buildBoard(results, chicagoToday, domesticDates, internationalDates, errors);
  await writeHistory(board, results);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(BOARD_PATH, JSON.stringify(board));
  return board;
}

function buildBoard(
  results: RouteDayResult[],
  chicagoToday: string,
  domesticDates: string[],
  internationalDates: string[],
  errorCount: number,
): BoardView {
  const flights = results
    .flatMap((result) => result.flights)
    .sort((a, b) => a.departsAt.localeCompare(b.departsAt) || a.price - b.price);

  const grouped = new Map<string, RouteDayResult[]>();
  for (const result of results) {
    const key = `${result.origin}-${result.destination}`;
    const list = grouped.get(key) ?? [];
    list.push(result);
    grouped.set(key, list);
  }

  const routes: RouteScore[] = [];
  for (const [key, days] of grouped) {
    const route = splitRouteKey(key);
    if (!route) continue;
    const { origin, destination } = route;
    const withService = days.filter((day) => day.status === "open" || day.status === "closed");
    const openDays = days.filter((day) => day.status === "open");
    const prices = openDays
      .map((day) => day.lowestPrice)
      .filter((price): price is number => price != null);
    const meta = CHICAGO_DESTINATIONS.find((item) => item.code === destination);
    routes.push({
      origin,
      originName: airportName(origin),
      destination,
      destinationCity: destinationCity(destination),
      international: meta?.international ?? false,
      daysChecked: withService.length,
      daysOpen: openDays.length,
      lowestPrice: prices.length > 0 ? Math.min(...prices) : null,
      historyDays: 0,
      historyOpenDays: 0,
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    chicagoToday,
    domesticDates,
    internationalDates,
    warning:
      errorCount > 0
        ? `Frontier answered ${results.length - errorCount} of ${results.length} searches. The rest got cut off, so some routes are missing until you refresh again later.`
        : null,
    searches: results.length,
    errors: errorCount,
    flights,
    routes: routes.sort(compareRoutes),
  };
}

async function writeHistory(board: BoardView, results: RouteDayResult[]) {
  const history = await readHistory();
  const byRoute = new Map<string, { status: "open" | "closed" | "no_service" | "error"; lowestPrice: number | null }>();
  for (const result of results) {
    const key = `${result.origin}-${result.destination}`;
    const current = byRoute.get(key);
    const next = rollupStatus(current?.status, result.status);
    const price =
      result.lowestPrice == null
        ? (current?.lowestPrice ?? null)
        : current?.lowestPrice == null
          ? result.lowestPrice
          : Math.min(current.lowestPrice, result.lowestPrice);
    byRoute.set(key, { status: next, lowestPrice: price });
  }

  const day: HistoryDay = {
    day: board.chicagoToday,
    at: board.checkedAt,
    routes: [...byRoute.entries()].flatMap(([key, value]) => {
      const route = splitRouteKey(key);
      if (!route) return [];
      return [{ ...route, ...value }];
    }),
  };

  const withoutToday = history.filter((entry) => entry.day !== board.chicagoToday);
  const next = [...withoutToday, day]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-HISTORY_LIMIT_DAYS);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(next));
  applyHistory(board, next);
  board.routes.sort(compareRoutes);
}

function applyHistory(board: BoardView, history: HistoryDay[]) {
  for (const route of board.routes) {
    const days = history
      .map((entry) => entry.routes.find((item) => item.origin === route.origin && item.destination === route.destination))
      .filter((item): item is HistoryDay["routes"][number] => item != null)
      .filter((item) => item.status === "open" || item.status === "closed");
    route.historyDays = days.length;
    route.historyOpenDays = days.filter((item) => item.status === "open").length;
  }
}

function rollupStatus(
  current: RouteDayResult["status"] | undefined,
  next: RouteDayResult["status"],
): "open" | "closed" | "no_service" | "error" {
  if (current === "open" || next === "open") return "open";
  if (current === "closed" || next === "closed") return "closed";
  if (current === "no_service" || next === "no_service") return "no_service";
  return "error";
}

function compareRoutes(a: RouteScore, b: RouteScore): number {
  const aRate = a.daysChecked === 0 ? -1 : a.daysOpen / a.daysChecked;
  const bRate = b.daysChecked === 0 ? -1 : b.daysOpen / b.daysChecked;
  if (bRate !== aRate) return bRate - aRate;
  const aHistory = a.historyDays === 0 ? -1 : a.historyOpenDays / a.historyDays;
  const bHistory = b.historyDays === 0 ? -1 : b.historyOpenDays / b.historyDays;
  if (bHistory !== aHistory) return bHistory - aHistory;
  return a.destinationCity.localeCompare(b.destinationCity);
}

async function readHistory(): Promise<HistoryDay[]> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf8");
    const parsed = JSON.parse(raw) as HistoryDay[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function chicagoDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function splitRouteKey(key: string): { origin: string; destination: string } | null {
  const [origin, destination] = key.split("-");
  if (!origin || !destination) return null;
  return { origin, destination };
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year == null || month == null || day == null) return isoDate;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
