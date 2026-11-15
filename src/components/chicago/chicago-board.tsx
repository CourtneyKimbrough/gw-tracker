"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { refreshChicagoBoard } from "@/app/actions";
import type { BoardView, FlightOffer, RouteScore } from "@/lib/frontier/types";

type AirportFilter = "ALL" | "ORD" | "MDW";

export function ChicagoBoard({ board }: { board: BoardView | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [airport, setAirport] = useState<AirportFilter>("ALL");
  const [nonstopOnly, setNonstopOnly] = useState(false);

  const flights = useMemo(() => {
    if (!board) return [];
    return board.flights.filter((flight) => matches(flight, airport, nonstopOnly));
  }, [airport, board, nonstopOnly]);

  const routes = useMemo(() => {
    if (!board) return [];
    return board.routes.filter(
      (route) => (airport === "ALL" || route.origin === airport) && route.daysChecked > 0,
    );
  }, [airport, board]);

  const cities = new Set(flights.map((flight) => `${flight.origin}-${flight.destination}`)).size;
  const nonstops = flights.filter((flight) => flight.stops === 0).length;
  const cheapest = flights.reduce<number | null>(
    (lowest, flight) => (lowest == null || flight.price < lowest ? flight.price : lowest),
    null,
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide text-foreground-subtle uppercase">Frontier GoWild</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Chicago</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
            Seats Frontier was selling from O&apos;Hare and Midway. Domestic flights can be booked the day
            before they leave. International flights, like Cancun and Montego Bay, open 10 days out. San Juan
            counts as domestic. Confirm on Frontier before you book.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await refreshChicagoBoard();
              router.refresh();
            })
          }
          disabled={pending}
          className="bg-accent text-accent-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Checking Frontier…" : "Refresh"}
        </button>
      </header>

      {pending ? (
        <p className="text-sm text-foreground-muted">
          Checking the bookable window from both Chicago airports. The first pass takes about a minute.
        </p>
      ) : null}

      {board?.warning ? (
        <p className="border-border bg-surface rounded-md border px-4 py-3 text-sm text-foreground-muted">
          {board.warning}
        </p>
      ) : null}

      {!board ? (
        <p className="text-sm text-foreground-muted">
          No check saved on this computer yet. Refresh to pull what&apos;s bookable out of Chicago right now.
        </p>
      ) : (
        <>
          <p className="text-xs text-foreground-subtle">
            Checked {formatWhen(board.checkedAt)} · Domestic {formatSpan(board.domesticDates)} · International{" "}
            {formatSpan(board.internationalDates)}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <FilterButton active={airport === "ALL"} onClick={() => setAirport("ALL")}>
              Both airports
            </FilterButton>
            <FilterButton active={airport === "ORD"} onClick={() => setAirport("ORD")}>
              O&apos;Hare
            </FilterButton>
            <FilterButton active={airport === "MDW"} onClick={() => setAirport("MDW")}>
              Midway
            </FilterButton>
            <label className="ml-2 flex items-center gap-2 text-sm text-foreground-muted">
              <input
                type="checkbox"
                checked={nonstopOnly}
                onChange={(event) => setNonstopOnly(event.target.checked)}
              />
              Nonstops only
            </label>
          </div>

          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Open itineraries" value={String(flights.length)} />
            <Stat label="Cities with a seat" value={String(cities)} />
            <Stat label="Cheapest GoWild" value={cheapest == null ? "—" : money(cheapest)} />
          </section>
          {!nonstopOnly && nonstops > 0 ? (
            <p className="-mt-6 text-xs text-foreground-subtle">{nonstops} of those are nonstop.</p>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">Available now</h2>
            {flights.length === 0 ? (
              <p className="mt-3 text-sm text-foreground-muted">
                Nothing with a GoWild fare in this view. Routes that had flights and no GoWild seats are in
                the table below.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs text-foreground-subtle">
                    <tr>
                      <th className="pr-4 pb-2 font-medium">From</th>
                      <th className="pr-4 pb-2 font-medium">To</th>
                      <th className="pr-4 pb-2 font-medium">Leaves</th>
                      <th className="pr-4 pb-2 font-medium">Arrives</th>
                      <th className="pr-4 pb-2 font-medium">Trip</th>
                      <th className="pr-4 pb-2 font-medium">Fare</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {flights.map((flight) => (
                      <tr key={flightKey(flight)} className="border-border border-t">
                        <td className="py-3 pr-4">
                          <div>{flight.originName}</div>
                          <div className="font-mono text-xs text-foreground-subtle">{flight.origin}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div>{flight.destinationCity}</div>
                          <div className="font-mono text-xs text-foreground-subtle">{flight.destination}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div>{formatDay(flight.date)}</div>
                          <div className="text-foreground-muted">{flight.departLabel}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div>{flight.arriveLabel}</div>
                          {flight.arrivesNextDay ? (
                            <div className="text-xs text-foreground-subtle">next day</div>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">
                          <div>{flight.stops === 0 ? "Nonstop" : stopLabel(flight)}</div>
                          <div className="text-xs text-foreground-subtle">
                            {flight.flightNumbers.join(" · ")}
                            {flight.duration ? ` · ${flight.duration}` : ""}
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono">
                          {money(flight.price)}
                          {flight.seats != null ? (
                            <div className="text-xs text-foreground-subtle">{flight.seats} seats</div>
                          ) : null}
                        </td>
                        <td className="py-3 text-right">
                          <a
                            href={flight.bookUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                          >
                            Book
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold">Which routes are usually open</h2>
            <p className="mt-1 max-w-2xl text-sm text-foreground-muted">
              The first column is this check: how many bookable days still had a GoWild fare. The second
              column is days saved on this computer, one check per day, so it gets sharper each day you
              refresh.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-foreground-subtle">
                  <tr>
                    <th className="pr-4 pb-2 font-medium">Route</th>
                    <th className="pr-4 pb-2 font-medium">This window</th>
                    <th className="pr-4 pb-2 font-medium">Past days</th>
                    <th className="pb-2 font-medium">Lowest fare</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => (
                    <tr key={`${route.origin}-${route.destination}`} className="border-border border-t">
                      <td className="py-3 pr-4">
                        {route.originName} to {route.destinationCity}
                        <div className="font-mono text-xs text-foreground-subtle">
                          {route.origin}–{route.destination}
                          {route.international ? " · international" : ""}
                        </div>
                      </td>
                      <td className="py-3 pr-4">{windowLabel(route)}</td>
                      <td className="py-3 pr-4">{historyLabel(route)}</td>
                      <td className="py-3 font-mono">{route.lowestPrice == null ? "—" : money(route.lowestPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${
        active ? "bg-surface text-foreground" : "text-foreground-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-md px-4 py-3">
      <div className="text-xs text-foreground-subtle">{label}</div>
      <div className="mt-1 font-mono text-2xl">{value}</div>
    </div>
  );
}

function matches(flight: FlightOffer, airport: AirportFilter, nonstopOnly: boolean) {
  if (airport !== "ALL" && flight.origin !== airport) return false;
  if (nonstopOnly && flight.stops !== 0) return false;
  return true;
}

function stopLabel(flight: FlightOffer) {
  const via = flight.stopCities.length > 0 ? ` · ${flight.stopCities.join(", ")}` : "";
  const noun = flight.stops === 1 ? "stop" : "stops";
  return `${flight.stops} ${noun}${via}`;
}

function windowLabel(route: RouteScore) {
  if (route.daysChecked === 0) return "No flights found";
  if (route.daysOpen === 0) return `Sold out · 0 of ${route.daysChecked} days`;
  if (route.daysOpen === route.daysChecked) return `Open all ${route.daysChecked} days`;
  return `Open ${route.daysOpen} of ${route.daysChecked} days`;
}

function historyLabel(route: RouteScore) {
  if (route.historyDays === 0) return "No saved days yet";
  if (route.historyDays === 1) {
    return route.historyOpenDays === 1 ? "Open on the only day saved" : "Closed on the only day saved";
  }
  return `Open ${route.historyOpenDays} of ${route.historyDays} days`;
}

function flightKey(flight: FlightOffer) {
  return `${flight.origin}-${flight.destination}-${flight.departsAt}-${flight.flightNumbers.join("-")}`;
}

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year == null || month == null || day == null) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatSpan(dates: string[]) {
  const start = dates[0];
  const end = dates[dates.length - 1];
  if (!start || !end) return "";
  if (start === end) return formatDay(start);
  return `${formatDay(start)} – ${formatDay(end)}`;
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
