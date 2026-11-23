import { z } from "zod";

/**
 * Public Supabase settings. Both values are safe to expose to the browser;
 * access control is enforced by Postgres row-level security.
 */
export const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    protocol: /^https?$/,
    error: "must be an http(s) URL",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: "is required" })
    .trim()
    .min(1, { error: "is required" }),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

/**
 * Validates the Supabase settings. Errors name the variables but never echo
 * their values.
 */
export function parseSupabaseEnv(
  source: Record<string, string | undefined>,
): SupabaseEnv {
  const result = supabaseEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid Supabase configuration: ${problems}. ` +
        "Run `pnpm db:env` for the local stack or see .env.example.",
    );
  }
  return result.data;
}

/**
 * Reads the settings at request time on the server, so builds succeed without
 * a Supabase instance. Passing the whole `process.env` object keeps Next.js
 * from inlining build-time values into server code.
 */
export function getServerSupabaseEnv(): SupabaseEnv {
  return parseSupabaseEnv(process.env);
}

/**
 * Reads the settings in browser code. Next.js inlines `NEXT_PUBLIC_` values
 * only for literal `process.env.NAME` references, so they are listed here.
 */
export function getBrowserSupabaseEnv(): SupabaseEnv {
  return parseSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
