import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminUser {
  id: string;
  email: string | null;
}

/**
 * Returns the signed-in admin for this request, or null. Checks two
 * things: (1) there's a valid Supabase Auth session (via the cookie-bound
 * client), and (2) that user's id is on the admin_users allow-list. Both
 * must hold — a valid login alone isn't enough to touch admin data.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) return null;

  return { id: user.id, email: user.email ?? null };
}
