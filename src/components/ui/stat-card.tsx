import type { ReactNode } from "react";

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-surface p-4">
      <div className="text-xs text-foreground-muted">{label}</div>
      <div className="mt-1 font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}
