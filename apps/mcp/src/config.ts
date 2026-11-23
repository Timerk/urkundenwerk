import { isAbsolute } from "node:path";
import { z } from "zod";

/**
 * Settings from the environment. The server signs in as one Urkundenwerk user
 * with the public Supabase URL and publishable key, exactly like the web
 * app's browser client, so row-level security decides every access. Secret
 * and service-role keys bypass RLS and are refused.
 */
export const configSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    protocol: /^https?$/,
    error: "must be an http(s) URL",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: "is required" })
    .trim()
    .min(1, { error: "is required" })
    .refine((key) => !isPrivilegedKey(key), {
      error:
        "must be the publishable key; secret and service-role keys bypass row-level security and are refused",
    }),
  URKUNDENWERK_EMAIL: z.email({ error: "must be an email address" }),
  URKUNDENWERK_PASSWORD: z
    .string({ error: "is required" })
    .min(1, { error: "is required" }),
  URKUNDENWERK_EXPORT_DIR: z
    .string()
    .trim()
    .refine((path) => isAbsolute(path), { error: "must be an absolute path" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type Config = {
  supabaseUrl: string;
  publishableKey: string;
  email: string;
  password: string;
  /** Root for exports written to disk. Writing is off without it. */
  exportDir: string | undefined;
};

/** True for `sb_secret_…` keys and legacy JWT keys with the service role. */
export function isPrivilegedKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return (
      typeof claims === "object" &&
      claims !== null &&
      (claims as { role?: unknown }).role === "service_role"
    );
  } catch {
    return false;
  }
}

/**
 * Validates the settings. Errors name the variables but never echo their
 * values, so a misplaced password does not end up in a log.
 */
export function parseConfig(
  source: Record<string, string | undefined>,
): Config {
  const result = configSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid Urkundenwerk MCP configuration: ${problems}. ` +
        "See apps/mcp/README.md for the required variables.",
    );
  }
  const env = result.data;
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    email: env.URKUNDENWERK_EMAIL,
    password: env.URKUNDENWERK_PASSWORD,
    exportDir: env.URKUNDENWERK_EXPORT_DIR,
  };
}
