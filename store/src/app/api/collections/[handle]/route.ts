import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, ApiError } from "@/lib/api";

export const OPTIONS = preflight;

export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    const admin = createAdminClient();

    const { data: collection, error } = await admin
      .from("collections")
      .select("*")
      .eq("handle", handle)
      .maybeSingle();
    if (error) throw error;
    if (!collection) throw new ApiError(404, "Collection not found");

    const { data: links } = await admin
      .from("product_collections")
      .select("product_id")
      .eq("collection_id", collection.id);
    const productIds = (links ?? []).map((l) => l.product_id);

    const { data: products } = productIds.length
      ? await admin.from("products").select("*").in("id", productIds).eq("status", "active")
      : { data: [] };

    return json(req, { collection, products: products ?? [] });
  } catch (err) {
    return errorJson(req, err);
  }
}
