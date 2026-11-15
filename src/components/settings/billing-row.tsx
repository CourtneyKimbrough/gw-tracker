"use client";

import { useState } from "react";

import type { SubscriptionPlan } from "@/types/database";

interface BillingResponse {
  checkout_url?: string;
  portal_url?: string;
}

/** Text-plus-action row, not a pricing table — account management, not a sales surface (docs/design.md §5). */
export function BillingRow({ plan }: { plan: SubscriptionPlan }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const endpoint =
        plan === "premium" ? "/api/v1/billing/portal-session" : "/api/v1/billing/checkout-session";
      const response = await fetch(endpoint, { method: "POST" });
      if (!response.ok) return;
      const data: BillingResponse = await response.json();
      const url = data.checkout_url ?? data.portal_url;
      if (url) {
        window.location.href = url;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-border py-4">
      <div>
        <div className="text-sm text-foreground">Plan</div>
        <div className="text-xs text-foreground-muted capitalize">{plan}</div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-sm text-accent hover:underline disabled:opacity-50"
      >
        {plan === "premium" ? "Manage plan" : "Upgrade"}
      </button>
    </div>
  );
}
