import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@urkundenwerk/core/db";
import type { Config } from "./config";

export type AppSupabaseClient = SupabaseClient<Database>;

/** A Supabase client that acts as one signed-in Urkundenwerk user. */
export interface UserSession {
  readonly client: AppSupabaseClient;
  readonly userId: string;
  /** Makes sure the next request carries a valid access token. */
  ensureActive(): Promise<void>;
  close(): Promise<void>;
}

export class AuthenticationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthenticationError";
  }
}

type Credentials = Pick<
  Config,
  "supabaseUrl" | "publishableKey" | "email" | "password"
>;

/**
 * Signs in with email and password through Supabase Auth and returns a client
 * that sends the user's JWT with every request, so Postgres row-level
 * security authorizes each query exactly as for the web app.
 *
 * The session lives in memory only. supabase-js refreshes an expiring access
 * token before a request; if the refresh token is no longer accepted, the
 * session signs in again with the configured credentials.
 */
export async function signIn(credentials: Credentials): Promise<UserSession> {
  const client = createClient<Database>(
    credentials.supabaseUrl,
    credentials.publishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );

  async function passwordSignIn(): Promise<string> {
    const { data, error } = await client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error || !data.user) {
      throw new AuthenticationError(
        "Signing in to Urkundenwerk failed. Check URKUNDENWERK_EMAIL, URKUNDENWERK_PASSWORD, and the Supabase URL.",
        { cause: error ?? undefined },
      );
    }
    return data.user.id;
  }

  const userId = await passwordSignIn();

  return {
    client,
    userId,
    async ensureActive() {
      // Refreshes the access token if it expires soon.
      const { data, error } = await client.auth.getSession();
      if (!error && data.session) return;
      const again = await passwordSignIn();
      if (again !== userId) {
        throw new AuthenticationError(
          "The credentials now belong to a different user. Restart the MCP server.",
        );
      }
    },
    async close() {
      // Revokes this session's refresh token only.
      await client.auth.signOut({ scope: "local" });
    },
  };
}
