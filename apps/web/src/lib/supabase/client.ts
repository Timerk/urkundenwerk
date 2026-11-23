import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@urkundenwerk/core/db";
import { getBrowserSupabaseEnv } from "../../env";

/**
 * Creates a Supabase client for Client Components. It shares the session
 * cookies with the server client.
 */
export function createClient() {
  const env = getBrowserSupabaseEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
