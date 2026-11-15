import { jsonError, jsonOk } from "@/lib/api-response";
import { getRouteDetail } from "@/lib/data/routes";
import { serializeRouteDetail } from "@/lib/serializers";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const detail = await getRouteDetail(supabase, slug);

  if (!detail) {
    return jsonError("not_found", `No tracked route matching ${slug.toUpperCase()}.`);
  }

  return jsonOk(serializeRouteDetail(detail));
}
