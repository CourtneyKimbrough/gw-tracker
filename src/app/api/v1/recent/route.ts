import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { jsonOk } from "@/lib/api-response";
import { getRecentActivity } from "@/lib/data/activity";
import { serializeRecentActivity } from "@/lib/serializers";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get("cursor");

  const supabase = await createClient();
  const page = await getRecentActivity(supabase, cursor, DEFAULT_PAGE_SIZE);

  return jsonOk(serializeRecentActivity(page));
}
