import { RECENTLY_RELEASED_WINDOW_HOURS } from "@/config/constants";
import type { RouteStatus } from "@/types/database";

export type DashboardBucket = "currently_available" | "recently_released" | "sold_out_today";

interface BucketInput {
  status: RouteStatus;
  firstDetectedAvailableAt: string | null;
  soldOutAt: string | null;
  airportTimezone: string;
  now?: Date;
}

/** The YYYY-MM-DD an instant falls on, in the given IANA timezone. */
export function localDateString(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function isSameLocalDay(a: Date, b: Date, timeZone: string): boolean {
  return localDateString(a, timeZone) === localDateString(b, timeZone);
}

/**
 * Implements the exact bucket rules from docs/prd.md §4. A route is in at most
 * one bucket, or none (e.g. status "unknown", or sold out on a previous day).
 */
export function bucketForRoute(input: BucketInput): DashboardBucket | null {
  const now = input.now ?? new Date();

  if (input.status === "available") {
    if (input.firstDetectedAvailableAt) {
      const detectedAt = new Date(input.firstDetectedAvailableAt);
      const hoursSinceDetected = (now.getTime() - detectedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceDetected < RECENTLY_RELEASED_WINDOW_HOURS) {
        return "recently_released";
      }
    }
    return "currently_available";
  }

  if (input.status === "sold_out" && input.soldOutAt) {
    const soldOutAt = new Date(input.soldOutAt);
    if (isSameLocalDay(soldOutAt, now, input.airportTimezone)) {
      return "sold_out_today";
    }
  }

  return null;
}
