import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, ApiError } from "@/lib/api";

export const OPTIONS = preflight;

export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    const admin = createAdminClient();

    const { data: product, error } = await admin
      .from("products")
      .select("*")
      .eq("handle", handle)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!product) throw new ApiError(404, "Product not found");

    const { data: variants } = await admin.from("variants").select("*").eq("product_id", product.id);

    const { data: links } = await admin
      .from("product_collections")
      .select("collection_id")
      .eq("product_id", product.id);
    const collectionIds = (links ?? []).map((l) => l.collection_id);
    const { data: collections } = collectionIds.length
      ? await admin.from("collections").select("id, handle, name").in("id", collectionIds)
      : { data: [] };

    return json(req, { product: { ...product, variants: variants ?? [], collections: collections ?? [] } });
  } catch (err) {
    return errorJson(req, err);
  }
}
