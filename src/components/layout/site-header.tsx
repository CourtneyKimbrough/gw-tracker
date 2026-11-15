import Link from "next/link";

import { AccountMenu } from "@/components/layout/account-menu";
import { SiteNav } from "@/components/layout/site-nav";
import { getAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * No persistent sidebar or tab bar (docs/design.md "Global navigation
 * philosophy") — the only standing chrome is the wordmark and a quiet
 * account affordance for the low-frequency Settings/Notifications pages.
 */
export async function SiteHeader() {
  const hasAuth = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const user = hasAuth ? await getAuthenticatedUser(await createClient()) : null;

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight text-foreground">
            GoWild
          </Link>
          <SiteNav />
        </div>

        {user?.email ? (
          <AccountMenu email={user.email} />
        ) : hasAuth ? (
          <Link href="/login" className="text-sm text-foreground-muted hover:text-foreground">
            Sign in
          </Link>
        ) : (
          <span className="text-sm text-foreground-muted">Chicago</span>
        )}
      </div>
    </header>
  );
}
