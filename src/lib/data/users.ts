import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, SubscriptionPlan } from "@/types/database";

type TypedClient = SupabaseClient<Database>;

export interface UserProfile {
  id: string;
  email: string;
  homeAirport: string | null;
  plan: SubscriptionPlan;
}

/**
 * Backs GET /api/v1/me. Lazily provisions the public.users row on first
 * authenticated request — this app never runs a separate "complete signup"
 * step; id is expected to equal the Supabase Auth user id (docs/database.md).
 */
export async function getOrCreateUserProfile(
  supabase: TypedClient,
  userId: string,
  email: string,
): Promise<UserProfile> {
  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("id, email, home_airport_code")
    .eq("id", userId)
    .maybeSingle();
  if (selectError) throw selectError;

  const profile =
    existing ??
    (await (async () => {
      const { data: inserted, error: insertError } = await supabase
        .from("users")
        .insert({ id: userId, email })
        .select("id, email, home_airport_code")
        .single();
      if (insertError) throw insertError;
      return inserted;
    })());

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;

  return {
    id: profile.id,
    email: profile.email,
    homeAirport: profile.home_airport_code,
    plan: subscription?.plan ?? "free",
  };
}

/** Backs PATCH /api/v1/me. `null` clears the home airport. */
export async function updateHomeAirport(
  supabase: TypedClient,
  userId: string,
  airportCode: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ home_airport_code: airportCode })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Backs DELETE /api/v1/me's app-data half. Deleting this row cascades to
 * alert_subscriptions, notification_log, and subscriptions (docs/database.md).
 * The caller is also responsible for removing the Supabase Auth identity via
 * the admin client (src/lib/supabase/admin.ts) — that's a separate trust
 * boundary this function intentionally doesn't cross.
 */
export async function deleteUserRow(supabase: TypedClient, userId: string): Promise<void> {
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) throw error;
}
