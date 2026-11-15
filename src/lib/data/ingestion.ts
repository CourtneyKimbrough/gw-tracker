import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json, RouteStatus } from "@/types/database";

type TypedClient = SupabaseClient<Database>;

export interface ScrapeResultInput {
  routeId: number;
  checkedAt: string;
  success: boolean;
  /** Worker-normalized status — raw HTML/JSON parsing happens in the scraper, not here. */
  rawStatus: "available" | "sold_out" | null;
  seatsRemaining: number | null;
  rawPayload?: Json | null;
}

export interface IngestResult {
  previousStatus: RouteStatus;
  newStatus: RouteStatus;
  transitioned: boolean;
}

/**
 * The diff engine behind POST /internal/v1/scrape-results. Implements
 * "snapshot-then-diff, not snapshot-then-display" (docs/architecture.md §5):
 * every call writes a raw scrape_snapshots row, but route_states (the
 * materialized table the dashboard reads) and route_events (the historical
 * log) are only touched when the observed status actually changes.
 */
export async function ingestScrapeResult(
  supabase: TypedClient,
  input: ScrapeResultInput,
): Promise<IngestResult> {
  const { error: snapshotError } = await supabase.from("scrape_snapshots").insert({
    route_id: input.routeId,
    checked_at: input.checkedAt,
    success: input.success,
    raw_status: input.rawStatus,
    raw_payload: input.rawPayload ?? null,
  });
  if (snapshotError) throw snapshotError;

  const { data: previous, error: previousError } = await supabase
    .from("route_states")
    .select("*")
    .eq("route_id", input.routeId)
    .single();
  if (previousError) throw previousError;

  // A blocked/failed scrape must never silently read as "sold out" — bump the
  // error counter and record it, but leave status untouched (docs/architecture.md §5).
  if (!input.success || !input.rawStatus) {
    const { error: updateError } = await supabase
      .from("route_states")
      .update({
        last_checked_at: input.checkedAt,
        consecutive_error_count: previous.consecutive_error_count + 1,
      })
      .eq("route_id", input.routeId);
    if (updateError) throw updateError;

    const { error: eventError } = await supabase.from("route_events").insert({
      route_id: input.routeId,
      event_type: "scrape_error",
      occurred_at: input.checkedAt,
    });
    if (eventError) throw eventError;

    return { previousStatus: previous.status, newStatus: previous.status, transitioned: false };
  }

  const newStatus: RouteStatus = input.rawStatus;
  const transitioned = newStatus !== previous.status;

  const update: Database["public"]["Tables"]["route_states"]["Update"] = {
    status: newStatus,
    last_checked_at: input.checkedAt,
    consecutive_error_count: 0,
    seats_remaining: input.seatsRemaining,
  };

  if (newStatus === "available") {
    update.last_available_at = input.checkedAt;
    if (transitioned) {
      // A fresh availability window — this is what "Recently Released" reads
      // from (docs/lib/bucketing.ts), not the route's all-time first sighting.
      update.first_detected_available_at = input.checkedAt;
      update.sold_out_at = null;
    }
  } else if (newStatus === "sold_out" && transitioned) {
    update.sold_out_at = input.checkedAt;
    if (previous.status === "available") {
      update.last_available_at = previous.last_checked_at ?? previous.last_available_at;
    }
  }

  const { error: updateError } = await supabase
    .from("route_states")
    .update(update)
    .eq("route_id", input.routeId);
  if (updateError) throw updateError;

  if (transitioned) {
    const { error: eventError } = await supabase.from("route_events").insert({
      route_id: input.routeId,
      event_type: newStatus === "available" ? "became_available" : "sold_out",
      occurred_at: input.checkedAt,
    });
    if (eventError) throw eventError;
  }

  return { previousStatus: previous.status, newStatus, transitioned };
}
