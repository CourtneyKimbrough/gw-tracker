const BUCKETS = [
  { title: "Currently Available", description: "Destinations you can fly to right now." },
  { title: "Recently Released", description: "Just opened up — these tend to disappear fast." },
  { title: "Sold Out Today", description: "Gone for now, with the time it sold out." },
];

/** Primes the three-bucket mental model before the user ever opens a dashboard (docs/design.md §1). */
export function BucketExplainer() {
  return (
    <section className="grid gap-6 border-t border-border py-12 sm:grid-cols-3">
      {BUCKETS.map((bucket) => (
        <div key={bucket.title}>
          <h3 className="text-sm font-medium text-foreground">{bucket.title}</h3>
          <p className="mt-1 text-sm text-foreground-muted">{bucket.description}</p>
        </div>
      ))}
    </section>
  );
}
