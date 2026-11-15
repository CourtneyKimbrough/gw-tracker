export type ChicagoAirport = {
  code: "ORD" | "MDW";
  name: string;
};

export type TrackedDestination = {
  code: string;
  city: string;
  /** International GoWild seats open 10 days before departure. Puerto Rico counts as domestic. */
  international: boolean;
};

export const CHICAGO_AIRPORTS: ChicagoAirport[] = [
  { code: "ORD", name: "O'Hare" },
  { code: "MDW", name: "Midway" },
];

/**
 * Nonstop cities Frontier publishes from Chicago. A live search still decides
 * whether a flight exists that day, and connections Frontier sells on the
 * same city pair are included.
 */
export const CHICAGO_DESTINATIONS: TrackedDestination[] = [
  { code: "ATL", city: "Atlanta", international: false },
  { code: "BWI", city: "Baltimore", international: false },
  { code: "CUN", city: "Cancun", international: true },
  { code: "DFW", city: "Dallas/Fort Worth", international: false },
  { code: "DEN", city: "Denver", international: false },
  { code: "FLL", city: "Fort Lauderdale", international: false },
  { code: "RSW", city: "Fort Myers", international: false },
  { code: "IAH", city: "Houston", international: false },
  { code: "LAS", city: "Las Vegas", international: false },
  { code: "LAX", city: "Los Angeles", international: false },
  { code: "MBJ", city: "Montego Bay", international: true },
  { code: "MCO", city: "Orlando", international: false },
  { code: "PHL", city: "Philadelphia", international: false },
  { code: "PHX", city: "Phoenix", international: false },
  { code: "SJU", city: "San Juan", international: false },
  { code: "TPA", city: "Tampa", international: false },
];

export function airportName(code: string): string {
  return CHICAGO_AIRPORTS.find((airport) => airport.code === code)?.name ?? code;
}

export function destinationCity(code: string): string {
  return CHICAGO_DESTINATIONS.find((destination) => destination.code === code)?.city ?? code;
}
