import { getAuthenticatedUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { deleteUserRow, getOrCreateUserProfile, updateHomeAirport } from "@/lib/data/users";
import { serializeUserProfile } from "@/lib/serializers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user || !user.email) {
    return jsonError("unauthorized", "Sign in to view your account.");
  }

  const profile = await getOrCreateUserProfile(supabase, user.id, user.email);
  return jsonOk(serializeUserProfile(profile), { cache: false });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user || !user.email) {
    return jsonError("unauthorized", "Sign in to update your account.");
  }

  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("home_airport" in body) ||
    (body.home_airport !== null && typeof body.home_airport !== "string")
  ) {
    return jsonError("bad_request", "Expected { home_airport: string | null }.");
  }

  await updateHomeAirport(supabase, user.id, body.home_airport as string | null);
  const profile = await getOrCreateUserProfile(supabase, user.id, user.email);
  return jsonOk(serializeUserProfile(profile), { cache: false });
}

export async function DELETE() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return jsonError("unauthorized", "Sign in to delete your account.");
  }

  // Two trust boundaries: the user's own row (RLS-scoped client, cascades to
  // alerts/notifications/billing per docs/database.md) and the Auth identity
  // itself, which only the service-role client can remove.
  await deleteUserRow(supabase, user.id);
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return jsonError("internal_error", "Account data was removed but sign-out cleanup failed.");
  }

  return new Response(null, { status: 204 });
}
