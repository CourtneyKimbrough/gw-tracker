"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { refreshWeekCatalog } from "@/app/actions";
import type { WeekCell, WeekFlight, WeekView } from "@/lib/frontier/week";

type AirportFilter = "ALL" | "ORD" | "MDW";

export function WeekBoard({ view }: { view: WeekView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [airport, setAirport] = useState<AirportFilter>("ALL");
  const [regularOnly, setRegularOnly] = useState(false);
  const [query, setQuery] = useState("");

  const flights = useMemo(() => {
    return view.flights.filter((flight) => matchesFlight(flight, airport, regularOnly, query));
  }, [airport, query, regularOnly, view.flights]);

  const cities = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return view.cities.filter((city) => {
      if (airport !== "ALL" && city.origin !== airport) return false;
      if (!needle) return true;
      return city.city.toLowerCase().includes(needle) || city.code.toLowerCase().includes(needle);
    });
  }, [airport, query, view.cities]);

  const regular = flights.filter((flight) => flight.regular).length;
  const withGoWild = flights.filter((flight) => flight.goWildSeen > 0).length;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide text-foreground-subtle uppercase">Frontier from Chicago</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">This week</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
            Every city Frontier sells from O&apos;Hare and Midway, then the flights that keep showing up.
            GoWild can be booked the day before for domestic flights and 10 days out for international ones.
            Sell-out time appears after a fare is seen open and then gone.
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

      {pending ? (
        <p className="text-sm text-foreground-muted">
          Working through the city list one day at a time. A full week is a long check, and it saves as it goes.
        </p>
      ) : null}
      {view.warning ? (
        <p className="border-border bg-surface rounded-md border px-4 py-3 text-sm text-foreground-muted">{view.warning}</p>
      ) : null}
      {view.updatedAt ? (
        <p className="text-xs text-foreground-subtle">Updated {formatWhen(view.updatedAt)}</p>
      ) : null}

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
          <input type="checkbox" checked={regularOnly} onChange={(event) => setRegularOnly(event.target.checked)} />
          Flights that usually operate
        </label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="City or code"
          className="border-border bg-surface ml-auto rounded-md border px-3 py-1.5 text-sm"
        />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Cities in the catalog" value={String(cities.length)} />
        <Stat label="Flights with times" value={String(flights.length)} />
        <Stat label="Seen with GoWild" value={String(withGoWild)} />
      </section>
      {regular > 0 ? <p className="-mt-6 text-xs text-foreground-subtle">{regular} operate on most checked days.</p> : null}

      <section>
        <h2 className="text-lg font-semibold">Flights this week</h2>
        <p className="mt-1 max-w-2xl text-sm text-foreground-muted">
          A day marked Flies is on the schedule outside the GoWild window. A price means GoWild was for sale. No
          GoWild means the flight was operating and the pass fare was not. A minute count is how long that fare
          lasted once this computer had seen it.
        </p>
        {flights.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">
            No flight times saved yet. Refresh to start with the first cities.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs text-foreground-subtle">
                <tr>
                  <th className="bg-background sticky left-0 pr-4 pb-2 font-medium">Flight</th>
                  <th className="pr-4 pb-2 font-medium">To</th>
                  {view.days.map((day) => (
                    <th key={day.date} className="pr-3 pb-2 font-medium">
                      {day.label}
                    </th>
                  ))}
                  <th className="pr-4 pb-2 font-medium">GoWild</th>
                  <th className="pb-2 font-medium">Sells out</th>
                </tr>
              </thead>
              <tbody>
                {flights.map((flight) => (
                  <tr key={flight.id} className="align-top">
                    <td className="bg-background sticky left-0 border-border border-t py-3 pr-4">
                      <div className="font-mono text-xs">{flight.flightNumbers.join(" · ")}</div>
                      <div className="text-foreground-muted">
                        {flight.originName} {flight.departLabel}
                      </div>
                      <div className="text-xs text-foreground-subtle">
                        {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops === 1 ? "" : "s"}`}
                        {flight.regular ? " · usual" : ""}
                      </div>
                    </td>
                    <td className="border-border border-t py-3 pr-4">
                      {flight.destinationCity}
                      <div className="font-mono text-xs text-foreground-subtle">{flight.destination}</div>
                    </td>
                    {flight.cells.map((cell) => (
                      <td key={cell.date} className="border-border border-t py-3 pr-3">
                        <Cell cell={cell} />
                      </td>
                    ))}
                    <td className="border-border border-t py-3 pr-4">{goWildLabel(flight)}</td>
                    <td className="border-border border-t py-3">{selloutLabel(flight.selloutMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Every city</h2>
        <p className="mt-1 max-w-2xl text-sm text-foreground-muted">
          {cities.filter((city) => city.status === "unchecked").length === 1
            ? "1 city still needs a schedule check."
            : `${cities.filter((city) => city.status === "unchecked").length} cities still need a schedule check.`}{" "}
          Cities
          with no flights after a check drop off the week grid.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-foreground-subtle">
              <tr>
                <th className="pr-4 pb-2 font-medium">From</th>
                <th className="pr-4 pb-2 font-medium">City</th>
                <th className="pr-4 pb-2 font-medium">Schedule</th>
                <th className="pr-4 pb-2 font-medium">GoWild flights</th>
                <th className="pb-2 font-medium">Typical sell-out</th>
              </tr>
            </thead>
            <tbody>
              {cities.map((city) => (
                <tr key={`${city.origin}-${city.code}`} className="border-border border-t">
                  <td className="py-2.5 pr-4">
                    {city.originName}
                    <div className="font-mono text-xs text-foreground-subtle">{city.origin}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    {city.city}
                    <div className="font-mono text-xs text-foreground-subtle">
                      {city.code}
                      {city.international ? " · international" : ""}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">{scheduleLabel(city)}</td>
                  <td className="py-2.5 pr-4">{city.goWildFlights === 0 ? "—" : String(city.goWildFlights)}</td>
                  <td className="py-2.5">{selloutLabel(city.selloutMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Cell({ cell }: { cell: WeekCell }) {
  if (cell.state === "unchecked" || cell.state === "absent") {
    return <span className="text-foreground-subtle">·</span>;
  }
  if (cell.state === "gowild") {
    return <span className="font-mono text-xs">{cell.price == null ? "GoWild" : money(cell.price)}</span>;
  }
  if (cell.state === "soldout") return <span className="text-xs">{cell.selloutMinutes}m</span>;
  if (cell.state === "none") return <span className="text-xs text-foreground-muted">No GoWild</span>;
  return <span className="text-xs text-foreground-muted">Flies</span>;
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
      className={`rounded-md border px-3 py-1.5 text-sm ${
        active ? "border-border bg-surface text-foreground" : "border-transparent text-foreground-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-surface rounded-md border px-4 py-3">
      <div className="text-xs text-foreground-subtle">{label}</div>
      <div className="mt-1 font-mono text-2xl">{value}</div>
    </div>
  );
}

function matchesFlight(flight: WeekFlight, airport: AirportFilter, regularOnly: boolean, query: string) {
  if (airport !== "ALL" && flight.origin !== airport) return false;
  if (regularOnly && !flight.regular) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    flight.destinationCity.toLowerCase().includes(needle) ||
    flight.destination.toLowerCase().includes(needle) ||
    flight.flightNumbers.join(" ").toLowerCase().includes(needle)
  );
}

function goWildLabel(flight: WeekFlight) {
  if (flight.goWildChecks === 0) return flight.goWildSeen > 0 ? `Seen ${flight.goWildSeen}` : "Not in window yet";
  return `${flight.goWildSeen} of ${flight.goWildChecks}`;
}

function selloutLabel(minutes: number | null) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function scheduleLabel(city: WeekView["cities"][number]) {
  if (city.status === "unchecked") return "Not checked yet";
  if (city.status === "no_service") return "No flights on the days checked";
  const usual = city.regularCount > 0 ? `, ${city.regularCount} usual` : "";
  return `${city.flightCount} flight${city.flightCount === 1 ? "" : "s"}${usual}`;
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
