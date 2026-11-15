import { RouteRow, type RouteRowVariant } from "@/components/dashboard/route-row";
import type { DashboardDestination } from "@/lib/data/airports";

interface DashboardSectionProps {
  title: string;
  origin: string;
  entries: DashboardDestination[];
  variant: RouteRowVariant;
}

function timestampFor(variant: RouteRowVariant, entry: DashboardDestination): string | null {
  if (variant === "sold_out") return entry.soldOutAt;
  if (variant === "recently_released") return entry.firstDetectedAvailableAt;
  // "Currently Available" intentionally shows no timestamp, per the product's
  // own dashboard example — only new and sold-out entries carry a time.
  return null;
}

/** Renders nothing when empty — section omission, not an empty-state placeholder (docs/design.md §3). */
export function DashboardSection({ title, origin, entries, variant }: DashboardSectionProps) {
  if (entries.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-2 flex items-baseline gap-2 px-1 text-sm font-medium text-foreground-muted">
        {title}
        <span className="font-mono text-xs text-foreground-subtle">{entries.length}</span>
      </h2>
      <div className="flex flex-col gap-px overflow-hidden rounded-lg">
        {entries.map((entry) => (
          <RouteRow
            key={entry.destination.code}
            origin={origin}
            destinationCode={entry.destination.code}
            destinationCity={entry.destination.city}
            variant={variant}
            timestamp={timestampFor(variant, entry)}
          />
        ))}
      </div>
    </section>
  );
}
