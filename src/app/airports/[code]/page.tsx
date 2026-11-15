import { notFound } from "next/navigation";

import { DashboardAutoRefresh } from "@/components/dashboard/dashboard-auto-refresh";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { StaleDataBanner } from "@/components/dashboard/stale-data-banner";
import { RelativeTime } from "@/components/ui/relative-time";
import { getAirportDashboard } from "@/lib/data/airports";
import { createClient } from "@/lib/supabase/server";

export default async function AirportDashboardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const dashboard = await getAirportDashboard(supabase, code);

  if (!dashboard) {
    notFound();
  }

  const isEmpty =
    dashboard.currentlyAvailable.length === 0 &&
    dashboard.recentlyReleased.length === 0 &&
    dashboard.soldOutToday.length === 0;

  return (
    <div>
      <DashboardAutoRefresh />
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-mono text-2xl font-semibold text-foreground">
          {dashboard.airport.code}
          <span className="ml-2 font-sans text-base font-normal text-foreground-muted">
            {dashboard.airport.city}
          </span>
        </h1>
        <span className="text-xs text-foreground-subtle">
          Updated <RelativeTime iso={dashboard.updatedAt} />
        </span>
      </div>

      {dashboard.dataStatus === "stale" ? <StaleDataBanner /> : null}

      {isEmpty ? (
        <p className="text-sm text-foreground-muted">No tracked routes from this airport yet.</p>
      ) : (
        <>
          <DashboardSection
            title="Currently Available"
            origin={dashboard.airport.code}
            entries={dashboard.currentlyAvailable}
            variant="available"
          />
          <DashboardSection
            title="Recently Released"
            origin={dashboard.airport.code}
            entries={dashboard.recentlyReleased}
            variant="recently_released"
          />
          <DashboardSection
            title="Sold Out Today"
            origin={dashboard.airport.code}
            entries={dashboard.soldOutToday}
            variant="sold_out"
          />
        </>
      )}
    </div>
  );
}
