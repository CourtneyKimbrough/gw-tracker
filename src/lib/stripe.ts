import Stripe from "stripe";

import { env } from "@/lib/env";

let client: Stripe | null = null;

/** Lazily constructed so build/typecheck never requires STRIPE_SECRET_KEY to be set. */
export function getStripeClient(): Stripe {
  if (!client) {
    client = new Stripe(env.stripeSecretKey());
  }
  return client;
}
