import { AirportList } from "@/components/airports/airport-list";
import { listTrackedAirports } from "@/lib/data/airports";
import { createClient } from "@/lib/supabase/server";

export default async function AirportSelectionPage() {
  const supabase = await createClient();
  const airports = await listTrackedAirports(supabase);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Choose your airport</h1>
      <AirportList airports={airports} />
    </div>
  );
}
