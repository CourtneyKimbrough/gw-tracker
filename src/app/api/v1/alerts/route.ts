import { jsonError, jsonOk } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAlert, listAlertsForUser } from "@/lib/data/alerts";
import { parseRouteSlug, resolveRouteId } from "@/lib/data/routes";
import { serializeAlert, serializeAlerts } from "@/lib/serializers";
import { createClient } from "@/lib/supabase/server";
import type { AlertChannel } from "@/types/database";

const VALID_CHANNELS: AlertChannel[] = ["email", "push", "sms"];

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return jsonError("unauthorized", "Sign in to view your alerts.");
  }

  const alerts = await listAlertsForUser(supabase, user.id);
  return jsonOk({ alerts: serializeAlerts(alerts) }, { cache: false });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return jsonError("unauthorized", "Sign in to create an alert.");
  }

  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("route" in body) ||
    !("channel" in body) ||
    typeof body.route !== "string" ||
    typeof body.channel !== "string"
  ) {
    return jsonError("bad_request", "Expected { route: 'ORD-DEN', channel: 'email' | 'push' | 'sms' }.");
  }

  const channel = body.channel as string;
  if (!VALID_CHANNELS.includes(channel as AlertChannel)) {
    return jsonError("bad_request", `channel must be one of: ${VALID_CHANNELS.join(", ")}.`);
  }

  const parsed = parseRouteSlug(body.route);
  if (!parsed) {
    return jsonError("bad_request", "route must look like 'ORD-DEN'.");
  }

  const routeId = await resolveRouteId(supabase, parsed.origin, parsed.destination);
  if (routeId === null) {
    return jsonError("not_found", `No tracked route matching ${body.route.toUpperCase()}.`);
  }

  const alert = await createAlert(supabase, user.id, routeId, channel as AlertChannel);
  return jsonOk(serializeAlert(alert), { status: 201, cache: false });
}
