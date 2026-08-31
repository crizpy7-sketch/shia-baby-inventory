import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, readJson, requireAdmin } from "@/lib/api";
import { adminCollectionSchema } from "@/lib/validation";

export const OPTIONS = preflight;

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin.from("collections").select("*").order("name", { ascending: true });
    if (error) throw error;
    return json(req, { collections: data ?? [] });
  } catch (err) {
    return errorJson(req, err);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = adminCollectionSchema.parse(await readJson(req));
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("collections")
      .insert({ handle: body.handle, name: body.name, description: body.description, type: body.type })
      .select("*")
      .single();
    if (error) throw error;
    return json(req, { collection: data }, 201);
  } catch (err) {
    return errorJson(req, err);
  }
}
