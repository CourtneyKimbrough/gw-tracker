import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getRouteHistory } from "@/lib/data/routes";
import { serializeRouteHistory } from "@/lib/serializers";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cursor = new URL(request.url).searchParams.get("cursor");

  const supabase = await createClient();
  const page = await getRouteHistory(supabase, slug, cursor, DEFAULT_PAGE_SIZE);

  if (!page) {
    return jsonError("not_found", `No tracked route matching ${slug.toUpperCase()}.`);
  }

  return jsonOk(serializeRouteHistory(page));
}
