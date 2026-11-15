"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { WeekCell, WeekCity, WeekFlight, WeekView } from "@/lib/frontier/week";

export function HistorySearch({ view, initialQuery }: { view: WeekView; initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const needle = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!needle) return [];
    return view.cities.filter(
      (city) => city.city.toLowerCase().includes(needle) || city.code.toLowerCase() === needle,
    );
  }, [needle, view.cities]);

  const selected = useMemo(() => {
    if (!needle) return [];
    const exact = view.cities.filter(
      (city) => city.city.toLowerCase() === needle || city.code.toLowerCase() === needle,
    );
    return exact.length > 0 ? exact : matches.length === 1 ? matches : [];
  }, [matches, needle, view.cities]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs tracking-wide text-foreground-subtle uppercase">Chicago</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Destination history</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          Type a city. You&apos;ll get the weekly flights saved from O&apos;Hare and Midway, and any GoWild
          record we have for them.
        </p>
      </header>

      <form
        className="max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          const next = query.trim();
          router.replace(next ? `/history?q=${encodeURIComponent(next)}` : "/history");
        }}
      >
        <label htmlFor="city" className="text-sm text-foreground-muted">
          City
        </label>
        <input
          id="city"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Atlanta, Denver, CUN"
          list="chicago-cities"
          className="border-border bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
        <datalist id="chicago-cities">
          {[...new Set(view.cities.map((city) => city.city))].map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </form>

      {needle && selected.length === 0 ? (
        <ul className="max-w-md space-y-1">
          {matches.slice(0, 8).map((city) => (
            <li key={`${city.origin}-${city.code}`}>
              <button
                type="button"
                className="text-accent text-sm hover:underline"
                onClick={() => {
                  setQuery(city.city);
                  router.replace(`/history?q=${encodeURIComponent(city.city)}`);
                }}
              >
                {city.city} ({city.code}) from {city.originName}
              </button>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="text-sm text-foreground-muted">No Chicago city matches that.</li>
          ) : null}
        </ul>
      ) : null}

      {selected.map((city) => (
        <DestinationHistory
          key={`${city.origin}-${city.code}`}
          city={city}
          days={view.days}
          flights={view.flights.filter((flight) => flight.origin === city.origin && flight.destination === city.code)}
        />
      ))}
    </div>
  );
}

function DestinationHistory({
  city,
  days,
  flights,
}: {
  city: WeekCity;
  days: WeekView["days"];
  flights: WeekFlight[];
}) {
  const withGoWild = flights.filter((flight) => flight.goWildSeen > 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          {city.originName} to {city.city}
        </h2>
        <p className="font-mono text-xs text-foreground-subtle">
          {city.origin}–{city.code}
          {city.international ? " · international" : ""}
        </p>
      </div>

      <div className="border-border bg-surface grid gap-3 rounded-md border px-4 py-3 sm:grid-cols-3">
        <HistoryStat label="Flights on the schedule" value={flights.length === 0 ? "None saved" : String(flights.length)} />
        <HistoryStat
          label="Seen with GoWild"
          value={withGoWild.length === 0 ? "No record yet" : String(withGoWild.length)}
        />
        <HistoryStat label="Typical sell-out" value={selloutLabel(city.selloutMinutes)} />
      </div>

      {flights.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          {city.status === "unchecked"
            ? "This city is in Frontier's Chicago list, and its weekly flights have not been checked yet."
            : "The days checked so far did not show a flight to this city."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-xs text-foreground-subtle">
              <tr>
                <th className="pr-4 pb-2 font-medium">Flight</th>
                {days.map((day) => (
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
                <tr key={flight.id} className="border-border border-t align-top">
                  <td className="py-3 pr-4">
                    <div className="font-mono text-xs">{flight.flightNumbers.join(" · ")}</div>
                    <div className="text-foreground-muted">{flight.departLabel}</div>
                    <div className="text-xs text-foreground-subtle">
                      {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops === 1 ? "" : "s"}`}
                      {flight.regular ? " · usual" : ""}
                    </div>
                  </td>
                  {flight.cells.map((cell) => (
                    <td key={cell.date} className="py-3 pr-3">
                      <Cell cell={cell} />
                    </td>
                  ))}
                  <td className="py-3 pr-4">{goWildLabel(flight)}</td>
                  <td className="py-3">{selloutLabel(flight.selloutMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Cell({ cell }: { cell: WeekCell }) {
  if (cell.state === "unchecked" || cell.state === "absent") return <span className="text-foreground-subtle">·</span>;
  if (cell.state === "gowild") {
    return <span className="font-mono text-xs">{cell.price == null ? "GoWild" : money(cell.price)}</span>;
  }
  if (cell.state === "soldout") return <span className="text-xs">{cell.selloutMinutes}m</span>;
  if (cell.state === "none") return <span className="text-xs text-foreground-muted">No GoWild</span>;
  return <span className="text-xs text-foreground-muted">Flies</span>;
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-foreground-subtle">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function goWildLabel(flight: WeekFlight) {
  if (flight.goWildChecks === 0 && flight.goWildSeen === 0) return "No record yet";
  if (flight.goWildChecks === 0) return `Seen ${flight.goWildSeen}`;
  return `${flight.goWildSeen} of ${flight.goWildChecks} checks`;
}

function selloutLabel(minutes: number | null) {
  if (minutes == null) return "Not timed yet";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
