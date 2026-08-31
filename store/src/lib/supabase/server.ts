import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-bound client for reading the *caller's* session (e.g. an admin
 * who signed in via Supabase Auth). Uses the anon key + RLS, so on its own
 * it can't read app data — it's only used to identify who is asking before
 * `createAdminClient()` does the actual data access. See lib/auth.ts.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options ?? {}));
        } catch {
          // called from a Server Component render where cookies can't be
          // mutated — safe to ignore, middleware refreshes the session.
        }
      },
    },
  });
}
