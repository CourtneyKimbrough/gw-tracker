"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { AirportSummary } from "@/lib/data/airports";

const HOME_AIRPORT_COOKIE = "gowild_home_airport";

/**
 * The hero's airport search — the product itself, not a button leading to it
 * (docs/design.md §1). Compact: results only appear while typing.
 */
export function AirportPicker({ airports }: { airports: AirportSummary[] }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return airports
      .filter(
        (airport) =>
          airport.code.toLowerCase().includes(normalized) ||
          airport.city.toLowerCase().includes(normalized) ||
          airport.name.toLowerCase().includes(normalized),
      )
      .slice(0, 8);
  }, [airports, query]);

  function selectAirport(code: string) {
    document.cookie = `${HOME_AIRPORT_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push(`/airports/${code}`);
  }

  return (
    <div className="w-full">
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search your airport"
        className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none"
      />
      {query ? (
        <div className="mt-2 flex flex-col gap-px overflow-hidden rounded-lg">
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
                <span className="text-sm text-foreground">{airport.city}</span>
                <span className="font-mono text-xs text-foreground-muted">{airport.code}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
