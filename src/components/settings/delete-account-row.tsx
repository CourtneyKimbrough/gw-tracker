"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Visually de-emphasized, separated by spacing rather than a heavy red box (docs/design.md §5). */
export function DeleteAccountRow() {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setPending(true);
    try {
      const response = await fetch("/api/v1/me", { method: "DELETE" });
      if (response.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="pt-8">
      <div className="text-sm text-foreground-muted">Danger zone</div>
      {confirming ? (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-sm text-danger hover:underline disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Confirm delete account"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm text-foreground-muted hover:underline"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 text-sm text-foreground-subtle hover:text-danger"
        >
          Delete account
        </button>
      )}
    </div>
  );
}
