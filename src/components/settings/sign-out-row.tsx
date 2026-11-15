"use client";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/browser";

export function SignOutRow() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="w-full border-b border-border py-4 text-left text-sm text-foreground-muted hover:text-foreground"
    >
      Sign out
    </button>
  );
}
