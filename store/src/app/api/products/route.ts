import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight } from "@/lib/api";

export const OPTIONS = preflight;

/**
 * GET /api/products?collection=<handle>&search=<text>&limit=<n>&offset=<n>
 * Public catalog listing. Only ever returns status="active" products.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const collectionHandle = url.searchParams.get("collection");
    const search = url.searchParams.get("search");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 24) || 24, 100);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

    const admin = createAdminClient();

    let productIdFilter: string[] | null = null;
    if (collectionHandle) {
      const { data: collection } = await admin
        .from("collections")
        .select("id")
        .eq("handle", collectionHandle)
        .maybeSingle();
      if (!collection) return json(req, { products: [], total: 0 });
      const { data: links } = await admin
        .from("product_collections")
        .select("product_id")
        .eq("collection_id", collection.id);
      productIdFilter = (links ?? []).map((l) => l.product_id);
      if (productIdFilter.length === 0) return json(req, { products: [], total: 0 });
    }

    let query = admin.from("products").select("*", { count: "exact" }).eq("status", "active");
    if (productIdFilter) query = query.in("id", productIdFilter);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data: products, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const productIds = (products ?? []).map((p) => p.id);
    const { data: variants } = productIds.length
      ? await admin.from("variants").select("*").in("product_id", productIds)
      : { data: [] };

    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants ?? []) {
      const list = variantsByProduct.get(v.product_id) ?? [];
      list.push(v);
      variantsByProduct.set(v.product_id, list);
    }

    const result = (products ?? []).map((p) => ({
      ...p,
      variants: variantsByProduct.get(p.id) ?? [],
    }));

    return json(req, { products: result, total: count ?? result.length });
  } catch (err) {
    return errorJson(req, err);
  }
}
