import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth";
import { listNotificationsForUser } from "@/lib/data/alerts";
import { serializeNotifications } from "@/lib/serializers";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return jsonError("unauthorized", "Sign in to view your notification history.");
  }

  const cursor = new URL(request.url).searchParams.get("cursor");
  const page = await listNotificationsForUser(supabase, user.id, cursor, DEFAULT_PAGE_SIZE);
  return jsonOk(serializeNotifications(page), { cache: false });
}
