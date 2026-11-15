import Link from "next/link";

import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { getAirportDashboard } from "@/lib/data/airports";
import { createClient } from "@/lib/supabase/server";

/**
 * Real, live data for one popular airport — replaces typical "trusted by"
 * marketing logos with the actual product (docs/design.md §1).
 */
export async function LiveProof({ airportCode }: { airportCode: string }) {
  const supabase = await createClient();
  const dashboard = await getAirportDashboard(supabase, airportCode);
  if (!dashboard) return null;

  return (
    <section className="border-t border-border py-12">
      <div className="mb-4 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-medium text-foreground-muted">
          Live right now — {dashboard.airport.city}
        </h2>
        <Link href={`/airports/${dashboard.airport.code}`} className="text-xs text-accent hover:underline">
          View full dashboard
        </Link>
      </div>
      <DashboardSection
        title="Currently Available"
        origin={dashboard.airport.code}
        entries={dashboard.currentlyAvailable.slice(0, 5)}
        variant="available"
      />
      <DashboardSection
        title="Recently Released"
        origin={dashboard.airport.code}
        entries={dashboard.recentlyReleased.slice(0, 5)}
        variant="recently_released"
      />
    </section>
  );
}
