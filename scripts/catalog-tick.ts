import { scanWeekCatalog } from "@/lib/frontier/week";

async function main() {
  const requested = Number(process.env.CATALOG_SEARCHES ?? 8);
  const maxSearches = Number.isFinite(requested) && requested > 0 ? requested : 8;
  const view = await scanWeekCatalog({ maxSearches });
  console.log(
    JSON.stringify({
      updatedAt: view.updatedAt,
      flights: view.flights.length,
      cities: view.cities.length,
      warning: view.warning,
      searches: maxSearches,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
