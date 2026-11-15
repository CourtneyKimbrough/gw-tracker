import { AirportPicker } from "@/components/airport-picker";
import type { AirportSummary } from "@/lib/data/airports";

export function Hero({ airports }: { airports: AirportSummary[] }) {
  return (
    <section className="py-12 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        See what&apos;s flying right now.
      </h1>
      <p className="mx-auto mt-3 max-w-md text-foreground-muted">
        Live GoWild availability for your airport. No dates, no search — just look.
      </p>
      <div className="mx-auto mt-6 max-w-sm">
        <AirportPicker airports={airports} />
      </div>
    </section>
  );
}
