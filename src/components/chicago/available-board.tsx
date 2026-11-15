"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { refreshWeekCatalog } from "@/app/actions";
import type { WeekFlight, WeekView } from "@/lib/frontier/week";

type OpenFare = {
  key: string;
  origin: string;
  originName: string;
  destination: string;
  destinationCity: string;
  date: string;
  departLabel: string;
  stops: number;
  stopCities: string[];
  flightNumbers: string[];
  duration: string;
  price: number | null;
};

export function AvailableBoard({ view }: { view: WeekView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fares = useMemo(() => openFares(view), [view]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide text-foreground-subtle uppercase">Chicago</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Available now</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
            GoWild fares Frontier was selling from O&apos;Hare and Midway at the last check. Flights without a
            GoWild fare stay off this list.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await refreshWeekCatalog();
              router.refresh();
            })
          }
          className="bg-accent text-accent-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Checking Frontier…" : "Refresh"}
        </button>
      </header>

      {view.warning ? (
        <p className="border-border bg-surface rounded-md border px-4 py-3 text-sm text-foreground-muted">{view.warning}</p>
      ) : null}
      {view.updatedAt ? <p className="text-xs text-foreground-subtle">Updated {formatWhen(view.updatedAt)}</p> : null}

      {fares.length === 0 ? (
        <p className="text-sm text-foreground-muted">No GoWild fares are saved from the last check.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-foreground-subtle">
              <tr>
                <th className="pr-4 pb-2 font-medium">From</th>
                <th className="pr-4 pb-2 font-medium">To</th>
                <th className="pr-4 pb-2 font-medium">Leaves</th>
                <th className="pr-4 pb-2 font-medium">Trip</th>
                <th className="pr-4 pb-2 font-medium">GoWild</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {fares.map((fare) => (
                <tr key={fare.key} className="border-border border-t">
                  <td className="py-3 pr-4">
                    {fare.originName}
                    <div className="font-mono text-xs text-foreground-subtle">{fare.origin}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <Link href={`/history?q=${encodeURIComponent(fare.destinationCity)}`} className="hover:underline">
                      {fare.destinationCity}
                    </Link>
                    <div className="font-mono text-xs text-foreground-subtle">{fare.destination}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div>{dayLabel(fare.date, view.days)}</div>
                    <div className="text-foreground-muted">{fare.departLabel}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div>{fare.stops === 0 ? "Nonstop" : stopLabel(fare.stops, fare.stopCities)}</div>
                    <div className="text-xs text-foreground-subtle">
                      {fare.flightNumbers.join(" · ")}
                      {fare.duration ? ` · ${fare.duration}` : ""}
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono">{fare.price == null ? "GoWild" : money(fare.price)}</td>
                  <td className="py-3 text-right">
                    <a href={bookUrl(fare)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Book
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function openFares(view: WeekView): OpenFare[] {
  const fares: OpenFare[] = [];
  for (const flight of view.flights) {
    for (const cell of flight.cells) {
      if (cell.state !== "gowild") continue;
      fares.push({
        key: `${flight.id}|${cell.date}`,
        origin: flight.origin,
        originName: flight.originName,
        destination: flight.destination,
        destinationCity: flight.destinationCity,
        date: cell.date,
        departLabel: flight.departLabel,
        stops: flight.stops,
        stopCities: flight.stopCities,
        flightNumbers: flight.flightNumbers,
        duration: flight.duration,
        price: cell.price,
      });
    }
  }
  return fares.sort(
    (a, b) => a.date.localeCompare(b.date) || departMinutes(a.departLabel) - departMinutes(b.departLabel),
  );
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

function bookUrl(fare: OpenFare) {
  const params = new URLSearchParams({
    o1: fare.origin,
    d1: fare.destination,
    dd1: fare.date,
    ADT: "1",
    mon: "true",
    r: "false",
  });
  return `https://booking.flyfrontier.com/Flight/InternalSelect?${params.toString()}`;
}

function stopLabel(stops: number, cities: string[]) {
  const via = cities.length > 0 ? ` · ${cities.join(", ")}` : "";
  return `${stops} stop${stops === 1 ? "" : "s"}${via}`;
}

function dayLabel(date: string, days: WeekView["days"]) {
  return days.find((day) => day.date === date)?.label ?? date;
}

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
