"use client";

import { useState } from "react";

import { AirportList } from "@/components/airports/airport-list";
import type { AirportSummary } from "@/lib/data/airports";

/** Reuses the Airport Selection page's list rather than duplicating that UI (docs/design.md §5). */
export function HomeAirportSetting({
  airports,
  currentCode,
}: {
  airports: AirportSummary[];
  currentCode: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(currentCode);
  const [saving, setSaving] = useState(false);

  async function handleSelect(newCode: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_airport: newCode }),
      });
      if (response.ok) {
        setCode(newCode);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-b border-border py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-foreground">Home airport</div>
          <div className="font-mono text-xs text-foreground-muted">{code ?? "Not set"}</div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          disabled={saving}
          className="text-sm text-accent hover:underline disabled:opacity-50"
        >
          {editing ? "Cancel" : "Change"}
        </button>
      </div>
      {editing ? (
        <div className="mt-3">
          <AirportList airports={airports} onSelect={handleSelect} />
        </div>
      ) : null}
    </div>
  );
}
