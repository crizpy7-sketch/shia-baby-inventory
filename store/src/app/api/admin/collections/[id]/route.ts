import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, requireAdmin, ApiError } from "@/lib/api";
import { adminCollectionUpdateSchema } from "@/lib/validation";
import type { Database } from "@/types/database";

type CollectionUpdate = Database["public"]["Tables"]["collections"]["Update"];

export const OPTIONS = preflight;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = adminCollectionUpdateSchema.parse(await readJson(req));
    const admin = createAdminClient();

    const { data: existing } = await admin.from("collections").select("id").eq("id", id).maybeSingle();
    if (!existing) throw new ApiError(404, "Collection not found");

    const update: CollectionUpdate = {};
    if (body.handle !== undefined) update.handle = body.handle;
    if (body.name !== undefined) update.name = body.name;
    if (body.description !== undefined) update.description = body.description;
    if (body.type !== undefined) update.type = body.type;

    const { data, error } = await admin.from("collections").update(update).eq("id", id).select("*").single();
    if (error) throw error;
    return json(req, { collection: data });
  } catch (err) {
    return errorJson(req, err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin.from("collections").delete().eq("id", id);
    if (error) throw error;
    return json(req, { ok: true });
  } catch (err) {
    return errorJson(req, err);
  }
}
