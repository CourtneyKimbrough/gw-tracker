import type { RouteStatus } from "@/types/database";

const LABELS: Record<RouteStatus, string> = {
  available: "Available",
  sold_out: "Sold Out",
  unknown: "Unknown",
};

const DOT: Record<RouteStatus, string> = {
  available: "bg-accent",
  sold_out: "bg-foreground-subtle",
  unknown: "bg-foreground-subtle",
};

export function StatusBadge({ status }: { status: RouteStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LABELS[status]}
    </span>
  );
}
