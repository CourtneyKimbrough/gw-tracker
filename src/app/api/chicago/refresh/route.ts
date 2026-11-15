import { scanChicagoBoard } from "@/lib/frontier/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const board = await scanChicagoBoard();
  return Response.json({
    checkedAt: board.checkedAt,
    flights: board.flights.length,
    routes: board.routes.length,
    errors: board.errors,
    warning: board.warning,
  });
}
