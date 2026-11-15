import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-2 text-xl font-semibold text-foreground">Sign in</h1>
      <p className="mb-6 text-sm text-foreground-muted">No password — we&apos;ll email you a link.</p>
      <LoginForm nextPath={next ?? "/"} />
    </div>
  );
}
