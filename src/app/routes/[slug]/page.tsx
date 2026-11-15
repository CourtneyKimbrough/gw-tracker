import { notFound } from "next/navigation";

import { NotifyToggle } from "@/components/route-detail/notify-toggle";
import { RouteHistoryList } from "@/components/route-detail/route-history-list";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthenticatedUser } from "@/lib/auth";
import { getAlertId } from "@/lib/data/alerts";
import { getRouteDetail, getRouteHistory, resolveRouteId } from "@/lib/data/routes";
import { formatDurationMinutes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function RouteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const detail = await getRouteDetail(supabase, slug);
  if (!detail) {
    notFound();
  }

  const [historyPage, user] = await Promise.all([
    getRouteHistory(supabase, slug, null),
    getAuthenticatedUser(supabase),
  ]);

  let initialAlertId: number | null = null;
  if (user) {
    const routeId = await resolveRouteId(supabase, detail.route.origin, detail.route.destination);
    if (routeId !== null) {
      initialAlertId = await getAlertId(supabase, user.id, routeId, "email");
    }
  }

  return (
    <div>
      <p className="mb-1 font-mono text-sm text-foreground-muted">
        {detail.route.origin} → {detail.route.destination}
      </p>
      <div className="mb-6 flex items-center justify-between">
        <StatusBadge status={detail.status} />
        {detail.status === "sold_out" ? (
          <NotifyToggle routeSlug={slug} initialAlertId={initialAlertId} />
        ) : null}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3">
        {detail.firstDetectedAvailableAt ? (
          <StatCard
            label="First detected"
            value={<RelativeTime iso={detail.firstDetectedAvailableAt} />}
          />
        ) : null}
        {detail.soldOutAt ? (
          <StatCard label="Sold out at" value={<RelativeTime iso={detail.soldOutAt} />} />
        ) : null}
        {detail.lastCheckedAt ? (
          <StatCard label="Last checked" value={<RelativeTime iso={detail.lastCheckedAt} />} />
        ) : null}
        {detail.seatsRemaining !== null ? (
          <StatCard label="Seats remaining" value={detail.seatsRemaining} />
        ) : null}
        <StatCard
          label="Average sell-out time"
          value={
            detail.averageSelloutMinutes !== null && detail.statsConfidence === "high"
              ? formatDurationMinutes(detail.averageSelloutMinutes)
              : "Not enough history yet"
          }
        />
      </div>

      <h2 className="mb-2 px-1 text-sm font-medium text-foreground-muted">History</h2>
      <RouteHistoryList
        routeSlug={slug}
        initialEvents={historyPage?.events ?? []}
        initialCursor={historyPage?.nextCursor ?? null}
      />
    </div>
  );
}
