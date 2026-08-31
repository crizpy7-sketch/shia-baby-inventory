import { createAdminClient } from "@/lib/supabase/admin";
import { json, errorJson, preflight, requireAdmin } from "@/lib/api";

export const OPTIONS = preflight;

/** GET /api/admin/waitlist — export Founding Families signups (e.g. for a manual Klaviyo sync). */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("waitlist_signups")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return json(req, { signups: data ?? [], total: data?.length ?? 0 });
  } catch (err) {
    return errorJson(req, err);
  }
}
