import { HistorySearch } from "@/components/chicago/history-search";
import { loadWeekView } from "@/lib/frontier/week";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const view = await loadWeekView();
  return <HistorySearch view={view} initialQuery={q ?? ""} />;
}
