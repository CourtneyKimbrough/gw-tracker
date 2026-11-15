/** Quiet inline line, not a modal or alert color — honest about data quality without being alarming (docs/design.md §3). */
export function StaleDataBanner() {
  return (
    <p className="mb-6 px-1 text-xs text-foreground-subtle">
      Data may be delayed — we&apos;re having trouble reaching the latest availability.
    </p>
  );
}
