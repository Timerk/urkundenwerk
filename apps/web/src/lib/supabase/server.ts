import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@urkundenwerk/core/db";
import { cookies } from "next/headers";
import { cache } from "react";
import { getServerSupabaseEnv } from "../../env";

/**
 * Creates a Supabase client for Server Components, Server Actions, and Route
 * Handlers. Requests run as the signed-in user, so RLS applies.
 */
export async function createClient() {
  // Reading cookies first marks the route as dynamic, so the environment is
  // only validated at request time and builds work without Supabase.
  const cookieStore = await cookies();
  const env = getServerSupabaseEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. The proxy refreshes the
            // session before rendering, so this write can be skipped.
          }
        },
      },
    },
  );
}

/**
 * Returns the user verified by the Supabase Auth server, or `null`. Use this
 * for authorization decisions; the cookie session alone is not trusted. The
 * result is shared by the layouts and pages of one request.
 */
export const getVerifiedUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});
