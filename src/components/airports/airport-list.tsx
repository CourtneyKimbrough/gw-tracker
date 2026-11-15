"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { AirportSummary } from "@/lib/data/airports";

const HOME_AIRPORT_COOKIE = "gowild_home_airport";

/**
 * The Airport Selection page's full list (docs/design.md §2) — search filters
 * it, but the whole list stays visible. Visited once by most users, ever.
 */
interface AirportListProps {
  airports: AirportSummary[];
  /** When provided (e.g. from Settings), called instead of the default cookie+navigate behavior. */
  onSelect?: (code: string) => void;
}

export function AirportList({ airports, onSelect }: AirportListProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return airports;
    return airports.filter(
      (airport) =>
        airport.code.toLowerCase().includes(normalized) ||
        airport.city.toLowerCase().includes(normalized) ||
        airport.name.toLowerCase().includes(normalized),
    );
  }, [airports, query]);

  function selectAirport(code: string) {
    if (onSelect) {
      onSelect(code);
      return;
    }
    document.cookie = `${HOME_AIRPORT_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push(`/airports/${code}`);
  }

  return (
    <div>
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by city or airport code"
        className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none"
      />

      <div className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg">
        {filtered.length === 0 ? (
          <p className="bg-surface px-4 py-3 text-sm text-foreground-subtle">No airports found.</p>
        ) : (
          filtered.map((airport) => (
            <button
              key={airport.code}
              type="button"
              onClick={() => selectAirport(airport.code)}
              className="flex items-center justify-between bg-surface px-4 py-3 text-left hover:bg-surface-hover"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    airport.availableCount > 0 ? "bg-accent" : "bg-foreground-subtle"
                  }`}
                />
                <span className="text-sm text-foreground">{airport.city}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-foreground-muted">{airport.availableCount} available</span>
                <span className="font-mono text-xs text-foreground-muted">{airport.code}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
