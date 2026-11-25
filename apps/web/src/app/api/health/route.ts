import { createClient } from "@supabase/supabase-js";
import type { Database } from "@urkundenwerk/core/db";
import { z } from "zod";
import { supabaseEnvSchema } from "../../../env";

const healthCheckResult = z.literal(true);
const healthCheckTimeoutMs = 5_000;

export async function GET() {
  const env = supabaseEnvSchema.safeParse(process.env);
  if (
    !env.success ||
    !env.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")
  ) {
    return healthResponse("unconfigured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), healthCheckTimeoutMs);
  try {
    // Keep the probe anonymous even when the visitor has a session cookie.
    const supabase = createClient<Database>(
      env.data.NEXT_PUBLIC_SUPABASE_URL,
      env.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
    const { data, error } = await supabase
      .rpc("health_check")
      .abortSignal(controller.signal);
    return healthResponse(
      !error && healthCheckResult.safeParse(data).success ? "ok" : "error",
    );
  } catch {
    return healthResponse("error");
  } finally {
    clearTimeout(timeout);
  }
}

function healthResponse(db: "ok" | "error" | "unconfigured") {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const ok = db === "ok";
  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      db,
      version: sha && /^[a-f0-9]{40}$/i.test(sha) ? sha : null,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
