import { AvailableBoard } from "@/components/chicago/available-board";
import { loadWeekView } from "@/lib/frontier/week";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const view = await loadWeekView();
  return <AvailableBoard view={view} />;
}
