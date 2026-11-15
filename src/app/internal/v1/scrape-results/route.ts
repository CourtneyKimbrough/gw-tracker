import { jsonError, jsonOk } from "@/lib/api-response";
import { ingestScrapeResult } from "@/lib/data/ingestion";
import { parseRouteSlug, resolveRouteId } from "@/lib/data/routes";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Not part of the public /api/v1 surface (docs/api.md "Internal" section) —
 * called by the scraping worker after every poll, authenticated with a shared
 * service token rather than a user session.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token !== env.internalApiToken()) {
    return jsonError("unauthorized", "Invalid or missing internal API token.");
  }

  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("route" in body) ||
    !("checked_at" in body) ||
    !("success" in body) ||
    typeof body.route !== "string" ||
    typeof body.checked_at !== "string" ||
    typeof body.success !== "boolean"
  ) {
    return jsonError(
      "bad_request",
      "Expected { route: 'ORD-DEN', checked_at: ISO string, success: boolean, raw_status?, seats_remaining? }.",
    );
  }

  const parsed = parseRouteSlug(body.route);
  if (!parsed) {
    return jsonError("bad_request", "route must look like 'ORD-DEN'.");
  }

  const admin = createAdminClient();
  const routeId = await resolveRouteId(admin, parsed.origin, parsed.destination);
  if (routeId === null) {
    return jsonError("not_found", `No tracked route matching ${body.route.toUpperCase()}.`);
  }

  const rawStatus =
    "raw_status" in body && (body.raw_status === "available" || body.raw_status === "sold_out")
      ? body.raw_status
      : null;
  const seatsRemaining =
    "seats_remaining" in body && typeof body.seats_remaining === "number"
      ? body.seats_remaining
      : null;
  const rawPayload = "raw_payload" in body ? (body.raw_payload as Json) : null;

  const result = await ingestScrapeResult(admin, {
    routeId,
    checkedAt: body.checked_at,
    success: body.success,
    rawStatus,
    seatsRemaining,
    rawPayload,
  });

  return jsonOk(
    {
      route_id: routeId,
      previous_status: result.previousStatus,
      new_status: result.newStatus,
      transitioned: result.transitioned,
    },
    { cache: false },
  );
}
