import { jsonOk } from "@/lib/api-response";
import { listTrackedAirports } from "@/lib/data/airports";
import { serializeAirportSummaries } from "@/lib/serializers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const airports = await listTrackedAirports(supabase);
  return jsonOk({ airports: serializeAirportSummaries(airports) });
}
