import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client for use in client components — e.g. an admin login form
 * (`supabase.auth.signInWithPassword`). Uses the anon key + RLS, so it
 * cannot read or write catalog/order data directly; all of that goes
 * through this app's own API routes.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
