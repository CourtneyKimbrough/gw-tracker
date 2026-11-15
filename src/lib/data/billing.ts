import type { SupabaseClient } from "@supabase/supabase-js";

import { getStripeClient } from "@/lib/stripe";
import type { Database } from "@/types/database";

type TypedClient = SupabaseClient<Database>;

/**
 * `subscriptions` only grants authenticated users a SELECT policy (docs/database.md,
 * RLS migration) — writes are a service-role operation. The caller must pass an
 * admin client (src/lib/supabase/admin.ts) and must have already authenticated
 * `userId` via the session-scoped client before calling this.
 */
export async function getOrCreateStripeCustomerId(
  admin: TypedClient,
  userId: string,
  email: string,
): Promise<string> {
  const { data: existing, error } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });

  const { error: upsertError } = await admin
    .from("subscriptions")
    .upsert({ user_id: userId, stripe_customer_id: customer.id }, { onConflict: "user_id" });
  if (upsertError) throw upsertError;

  return customer.id;
}
