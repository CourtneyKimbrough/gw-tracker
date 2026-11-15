import Stripe from "stripe";

import { jsonError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionStatus } from "@/types/database";

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}

/** Not client-facing — Stripe calls this server-to-server (docs/api.md "Billing"). */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("bad_request", "Missing stripe-signature header.");
  }

  const payload = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret());
  } catch {
    return jsonError("bad_request", "Invalid Stripe webhook signature.");
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

    const status = mapStripeStatus(subscription.status);
    const plan = status === "active" ? "premium" : "free";
    const periodEndSeconds = subscription.items.data[0]?.current_period_end ?? null;

    const admin = createAdminClient();
    const { error } = await admin
      .from("subscriptions")
      .update({
        stripe_subscription_id: subscription.id,
        plan,
        status,
        current_period_end: periodEndSeconds ? new Date(periodEndSeconds * 1000).toISOString() : null,
      })
      .eq("stripe_customer_id", customerId);

    if (error) {
      return jsonError("internal_error", "Failed to apply subscription update.");
    }
  }

  return new Response(null, { status: 200 });
}
