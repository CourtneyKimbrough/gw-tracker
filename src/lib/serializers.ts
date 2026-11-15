// Converts internal camelCase data-layer shapes into the snake_case JSON
// contract documented in docs/api.md. Keeping this conversion in one place
// means every route handler produces a consistent shape without having to
// remember field-by-field mapping.

import type { AirportDashboard, AirportSummary, DashboardDestination } from "@/lib/data/airports";
import type { RecentActivityPage } from "@/lib/data/activity";
import type { AlertSummary, NotificationPage } from "@/lib/data/alerts";
import type { RouteDetail, RouteHistoryPage } from "@/lib/data/routes";
import type { UserProfile } from "@/lib/data/users";

export function serializeAirportSummaries(airports: AirportSummary[]) {
  return airports.map((airport) => ({
    code: airport.code,
    name: airport.name,
    city: airport.city,
    available_count: airport.availableCount,
  }));
}

function serializeDestination(entry: DashboardDestination) {
  return {
    destination: entry.destination,
    first_detected_available_at: entry.firstDetectedAvailableAt,
    sold_out_at: entry.soldOutAt,
    last_checked_at: entry.lastCheckedAt,
  };
}

export function serializeDashboard(dashboard: AirportDashboard) {
  return {
    airport: dashboard.airport,
    updated_at: dashboard.updatedAt,
    data_status: dashboard.dataStatus,
    currently_available: dashboard.currentlyAvailable.map(serializeDestination),
    recently_released: dashboard.recentlyReleased.map(serializeDestination),
    sold_out_today: dashboard.soldOutToday.map(serializeDestination),
  };
}

export function serializeRouteDetail(detail: RouteDetail) {
  return {
    route: detail.route,
    status: detail.status,
    first_detected_available_at: detail.firstDetectedAvailableAt,
    sold_out_at: detail.soldOutAt,
    last_checked_at: detail.lastCheckedAt,
    seats_remaining: detail.seatsRemaining,
    average_sellout_minutes: detail.averageSelloutMinutes,
    stats_confidence: detail.statsConfidence,
  };
}

export function serializeRouteHistory(page: RouteHistoryPage) {
  return {
    events: page.events.map((event) => ({
      event_type: event.eventType,
      occurred_at: event.occurredAt,
    })),
    next_cursor: page.nextCursor,
  };
}

export function serializeRecentActivity(page: RecentActivityPage) {
  return {
    events: page.events.map((event) => ({
      airport: event.airport,
      destination: event.destination,
      event_type: event.eventType,
      occurred_at: event.occurredAt,
    })),
    next_cursor: page.nextCursor,
  };
}

export function serializeUserProfile(profile: UserProfile) {
  return {
    id: profile.id,
    email: profile.email,
    home_airport: profile.homeAirport,
    plan: profile.plan,
  };
}

export function serializeAlert(alert: AlertSummary) {
  return {
    id: alert.id,
    route: alert.route,
    channel: alert.channel,
    created_at: alert.createdAt,
  };
}

export function serializeAlerts(alerts: AlertSummary[]) {
  return alerts.map(serializeAlert);
}

export function serializeNotifications(page: NotificationPage) {
  return {
    notifications: page.notifications.map((notification) => ({
      id: notification.id,
      route: notification.route,
      channel: notification.channel,
      event_type: notification.eventType,
      sent_at: notification.sentAt,
    })),
    next_cursor: page.nextCursor,
  };
}
