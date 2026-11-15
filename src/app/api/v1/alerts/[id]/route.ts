import { jsonError } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth";
import { deleteAlert } from "@/lib/data/alerts";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isInteger(alertId)) {
    return jsonError("bad_request", "Alert id must be an integer.");
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return jsonError("unauthorized", "Sign in to manage your alerts.");
  }

  const deleted = await deleteAlert(supabase, user.id, alertId);
  if (!deleted) {
    return jsonError("not_found", `No alert ${alertId} for this account.`);
  }

  return new Response(null, { status: 204 });
}
