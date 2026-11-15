import { jsonError, jsonOk } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return jsonError("unauthorized", "Sign in to manage your plan.");
  }

  const admin = createAdminClient();
  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!subscription?.stripe_customer_id) {
    return jsonError("not_found", "No billing account yet — upgrade first.");
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${env.siteUrl()}/settings`,
  });

  return jsonOk({ portal_url: session.url }, { cache: false });
}
