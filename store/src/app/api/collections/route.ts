import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight } from "@/lib/api";

export const OPTIONS = preflight;

export async function GET(req: Request) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("collections").select("*").order("name", { ascending: true });
    if (error) throw error;
    return json(req, { collections: data ?? [] });
  } catch (err) {
    return errorJson(req, err);
  }
}
