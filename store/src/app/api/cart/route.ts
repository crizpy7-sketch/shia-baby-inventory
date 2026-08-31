import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight } from "@/lib/api";

export const OPTIONS = preflight;

/** POST /api/cart — creates a new empty cart and returns its id. */
export async function POST(req: Request) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("carts").insert({}).select("*").single();
    if (error) throw error;
    return json(req, { cart: data }, 201);
  } catch (err) {
    return errorJson(req, err);
  }
}
