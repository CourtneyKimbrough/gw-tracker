/** Matches the exact shape of the content it stands in for (docs/design.md "Perceived performance") — no spinners. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface ${className}`} />;
}
