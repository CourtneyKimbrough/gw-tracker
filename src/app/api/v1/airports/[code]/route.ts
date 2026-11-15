import { jsonError, jsonOk } from "@/lib/api-response";
import { getAirportByCode } from "@/lib/data/airports";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const airport = await getAirportByCode(supabase, code);

  if (!airport) {
    return jsonError("not_found", `No tracked airport with code ${code.toUpperCase()}.`);
  }

  return jsonOk(airport);
}
