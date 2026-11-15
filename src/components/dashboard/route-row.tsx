import Link from "next/link";

import { RelativeTime } from "@/components/ui/relative-time";

export type RouteRowVariant = "available" | "recently_released" | "sold_out";

const ACCENT_BORDER: Record<RouteRowVariant, string> = {
  available: "border-l-border",
  recently_released: "border-l-accent",
  sold_out: "border-l-border",
};

const TEXT_COLOR: Record<RouteRowVariant, string> = {
  available: "text-foreground",
  recently_released: "text-foreground",
  sold_out: "text-foreground-muted",
};

interface RouteRowProps {
  origin: string;
  destinationCode: string;
  destinationCity: string;
  variant: RouteRowVariant;
  timestamp: string | null;
}

/** Status is a thin left-edge bar, not a full-row tint — avoids a "traffic light" look (docs/design.md §3). */
export function RouteRow({ origin, destinationCode, destinationCity, variant, timestamp }: RouteRowProps) {
  return (
    <Link
      href={`/routes/${origin}-${destinationCode}`}
      className={`flex items-center justify-between border-l-2 ${ACCENT_BORDER[variant]} bg-surface px-4 py-3 transition-colors hover:bg-surface-hover`}
    >
      <span className={`text-sm ${TEXT_COLOR[variant]}`}>{destinationCity}</span>
      {timestamp ? (
        <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
          {variant === "recently_released" ? (
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          ) : null}
          <RelativeTime iso={timestamp} />
        </span>
      ) : null}
    </Link>
  );
}
