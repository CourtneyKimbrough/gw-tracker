import { scanWeekCatalog } from "@/lib/frontier/week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const view = await scanWeekCatalog();
  return Response.json({
    updatedAt: view.updatedAt,
    flights: view.flights.length,
    cities: view.cities.length,
    warning: view.warning,
  });
}
