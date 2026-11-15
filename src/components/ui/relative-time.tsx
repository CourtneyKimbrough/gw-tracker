import { formatAbsoluteTime, formatRelativeTime } from "@/lib/format";

/**
 * "12m ago" with the absolute timestamp on hover/tap via the native `title`
 * tooltip — same convention as GitHub/Linear (docs/design.md §3). No client
 * JS needed.
 */
export function RelativeTime({ iso, timeZone }: { iso: string; timeZone?: string }) {
  return (
    <time dateTime={iso} title={formatAbsoluteTime(iso, timeZone)} className="font-mono">
      {formatRelativeTime(iso)}
    </time>
  );
}
