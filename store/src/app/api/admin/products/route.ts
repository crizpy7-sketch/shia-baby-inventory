import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, requireAdmin } from "@/lib/api";
import { adminProductSchema } from "@/lib/validation";

export const OPTIONS = preflight;

/** GET /api/admin/products — every product regardless of status. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin.from("products").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return json(req, { products: data ?? [] });
  } catch (err) {
    return errorJson(req, err);
  }
}

/** POST /api/admin/products — create a product with its variants and collection links. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = adminProductSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { data: product, error } = await admin
      .from("products")
      .insert({
        handle: body.handle,
        name: body.name,
        description: body.description,
        status: body.status,
        vendor: body.vendor,
        product_type: body.productType,
        tags: body.tags,
        price_cents: body.priceCents,
        compare_at_price_cents: body.compareAtPriceCents,
        gift_ready: body.giftReady,
        materials: body.materials,
        care_instructions: body.careInstructions,
        images: body.images,
      })
      .select("*")
      .single();
    if (error) throw error;

    if (body.variants.length > 0) {
      const { error: variantsError } = await admin.from("variants").insert(
        body.variants.map((v) => ({
          product_id: product.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          price_override_cents: v.priceOverrideCents,
          inventory_count: v.inventoryCount,
        }))
      );
      if (variantsError) throw variantsError;
    }

    if (body.collectionIds.length > 0) {
      const { error: linksError } = await admin
        .from("product_collections")
        .insert(body.collectionIds.map((collectionId) => ({ product_id: product.id, collection_id: collectionId })));
      if (linksError) throw linksError;
    }

    const { data: variants } = await admin.from("variants").select("*").eq("product_id", product.id);
    return json(req, { product: { ...product, variants: variants ?? [] } }, 201);
  } catch (err) {
    return errorJson(req, err);
  }
}
