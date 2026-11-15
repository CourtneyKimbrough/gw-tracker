export type FlightOffer = {
  origin: string;
  originName: string;
  destination: string;
  destinationCity: string;
  /** Departure calendar day, YYYY-MM-DD, in the departure airport's local time. */
  date: string;
  departsAt: string;
  arrivesAt: string;
  departLabel: string;
  arriveLabel: string;
  arrivesNextDay: boolean;
  stops: number;
  stopCities: string[];
  duration: string;
  price: number;
  seats: number | null;
  flightNumbers: string[];
  bookUrl: string;
};

export type RouteDayStatus = "open" | "closed" | "no_service" | "error";

export type RouteDayResult = {
  origin: string;
  destination: string;
  date: string;
  status: RouteDayStatus;
  lowestPrice: number | null;
  flights: FlightOffer[];
  error?: string;
};

export type RouteScore = {
  origin: string;
  originName: string;
  destination: string;
  destinationCity: string;
  international: boolean;
  /** Bookable days Frontier actually had flights, in the latest check. */
  daysChecked: number;
  daysOpen: number;
  lowestPrice: number | null;
  /** Distinct days this computer has checked the route and Frontier had flights. */
  historyDays: number;
  historyOpenDays: number;
};

export type BoardView = {
  checkedAt: string;
  chicagoToday: string;
  domesticDates: string[];
  internationalDates: string[];
  warning: string | null;
  searches: number;
  errors: number;
  flights: FlightOffer[];
  routes: RouteScore[];
};

export type HistoryDay = {
  day: string;
  at: string;
  routes: Array<{
    origin: string;
    destination: string;
    status: "open" | "closed" | "no_service" | "error";
    lowestPrice: number | null;
  }>;
};
