import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, requireAdmin, ApiError } from "@/lib/api";
import { adminProductUpdateSchema } from "@/lib/validation";
import type { Database } from "@/types/database";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

export const OPTIONS = preflight;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();

    const { data: product } = await admin.from("products").select("*").eq("id", id).maybeSingle();
    if (!product) throw new ApiError(404, "Product not found");
    const { data: variants } = await admin.from("variants").select("*").eq("product_id", id);
    const { data: links } = await admin.from("product_collections").select("collection_id").eq("product_id", id);

    return json(req, {
      product: { ...product, variants: variants ?? [], collectionIds: (links ?? []).map((l) => l.collection_id) },
    });
  } catch (err) {
    return errorJson(req, err);
  }
}

/** PATCH /api/admin/products/:id — partial update. Passing `variants` replaces the full variant set. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = adminProductUpdateSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { data: existing } = await admin.from("products").select("id").eq("id", id).maybeSingle();
    if (!existing) throw new ApiError(404, "Product not found");

    const update: ProductUpdate = {};
    if (body.handle !== undefined) update.handle = body.handle;
    if (body.name !== undefined) update.name = body.name;
    if (body.description !== undefined) update.description = body.description;
    if (body.status !== undefined) update.status = body.status;
    if (body.vendor !== undefined) update.vendor = body.vendor;
    if (body.productType !== undefined) update.product_type = body.productType;
    if (body.tags !== undefined) update.tags = body.tags;
    if (body.priceCents !== undefined) update.price_cents = body.priceCents;
    if (body.compareAtPriceCents !== undefined) update.compare_at_price_cents = body.compareAtPriceCents;
    if (body.giftReady !== undefined) update.gift_ready = body.giftReady;
    if (body.materials !== undefined) update.materials = body.materials;
    if (body.careInstructions !== undefined) update.care_instructions = body.careInstructions;
    if (body.images !== undefined) update.images = body.images;

    if (Object.keys(update).length > 0) {
      const { error } = await admin.from("products").update(update).eq("id", id);
      if (error) throw error;
    }

    if (body.variants !== undefined) {
      // Simplest correct approach: replace the variant set wholesale.
      // Existing variants referenced by past orders keep their history via
      // order_items.product_name/variant_label snapshots, so this is safe.
      await admin.from("variants").delete().eq("product_id", id);
      if (body.variants.length > 0) {
        const { error: variantsError } = await admin.from("variants").insert(
          body.variants.map((v) => ({
            product_id: id,
            sku: v.sku,
            size: v.size,
            color: v.color,
            price_override_cents: v.priceOverrideCents,
            inventory_count: v.inventoryCount,
          }))
        );
        if (variantsError) throw variantsError;
      }
    }

    if (body.collectionIds !== undefined) {
      await admin.from("product_collections").delete().eq("product_id", id);
      if (body.collectionIds.length > 0) {
        const { error: linksError } = await admin
          .from("product_collections")
          .insert(body.collectionIds.map((collectionId) => ({ product_id: id, collection_id: collectionId })));
        if (linksError) throw linksError;
      }
    }

    const { data: product } = await admin.from("products").select("*").eq("id", id).single();
    const { data: variants } = await admin.from("variants").select("*").eq("product_id", id);
    return json(req, { product: { ...product, variants: variants ?? [] } });
  } catch (err) {
    return errorJson(req, err);
  }
}

/** DELETE /api/admin/products/:id */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin.from("products").delete().eq("id", id);
    if (error) throw error;
    return json(req, { ok: true });
  } catch (err) {
    return errorJson(req, err);
  }
}
