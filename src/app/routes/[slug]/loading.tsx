import { Skeleton } from "@/components/ui/skeleton";

export default function RouteDetailLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-6 h-6 w-32" />
      <div className="mb-8 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
