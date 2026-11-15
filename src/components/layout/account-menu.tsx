"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/browser";

export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.refresh();
    router.push("/");
  }

  return (
    <div className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-sm text-foreground-muted hover:bg-surface-hover"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {email.charAt(0).toUpperCase()}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <div className="truncate px-3 py-2 text-xs text-foreground-subtle">{email}</div>
          <Link
            href="/settings"
            role="menuitem"
            className="block px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <Link
            href="/notifications"
            role="menuitem"
            className="block px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
            onClick={() => setOpen(false)}
          >
            Notifications
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="block w-full px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-hover"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
