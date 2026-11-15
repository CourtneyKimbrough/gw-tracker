import Link from "next/link";

export default function RouteNotFound() {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-foreground-muted">We don&apos;t track that route.</p>
      <Link href="/airports" className="mt-2 inline-block text-sm text-accent hover:underline">
        Choose an airport
      </Link>
    </div>
  );
}
