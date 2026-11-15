import { jsonError, jsonOk } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth";
import { getOrCreateStripeCustomerId } from "@/lib/data/billing";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user || !user.email) {
    return jsonError("unauthorized", "Sign in to upgrade your plan.");
  }

  const admin = createAdminClient();
  const customerId = await getOrCreateStripeCustomerId(admin, user.id, user.email);

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: env.stripePremiumPriceId(), quantity: 1 }],
    success_url: `${env.siteUrl()}/settings?upgraded=1`,
    cancel_url: `${env.siteUrl()}/settings`,
  });

  if (!session.url) {
    return jsonError("internal_error", "Stripe did not return a checkout URL.");
  }

  return jsonOk({ checkout_url: session.url }, { cache: false });
}
