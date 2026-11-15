import { jsonError, jsonOk } from "@/lib/api-response";
import { getAirportDashboard } from "@/lib/data/airports";
import { serializeDashboard } from "@/lib/serializers";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const dashboard = await getAirportDashboard(supabase, code);

  if (!dashboard) {
    return jsonError("not_found", `No tracked airport with code ${code.toUpperCase()}.`);
  }

  return jsonOk(serializeDashboard(dashboard));
}
