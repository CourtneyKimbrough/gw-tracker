import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-foreground-muted">Page not found.</p>
      <Link href="/" className="mt-2 inline-block text-sm text-accent hover:underline">
        Go home
      </Link>
    </div>
  );
}
