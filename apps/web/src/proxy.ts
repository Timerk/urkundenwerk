import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Only routes that use the session run the proxy, so public pages keep
// working without a Supabase instance.
export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};
