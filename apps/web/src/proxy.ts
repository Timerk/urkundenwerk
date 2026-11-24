import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabaseEnv, type SupabaseEnv } from "./env";
import { LOCALE_COOKIE, resolveLocale } from "./i18n/locale";
import { MESSAGES } from "./i18n/messages";
import { isSignupEnabled } from "./lib/auth/signup";
import { updateSession, usesSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  const path = request.nextUrl.pathname;
  const session =
    usesSession(path) && (path !== "/signup" || isSignupEnabled());
  let env: SupabaseEnv | undefined;
  if (production || session) {
    try {
      env = getServerSupabaseEnv();
    } catch (error) {
      console.error(error);
      const locale = resolveLocale({
        cookie: request.cookies.get(LOCALE_COOKIE)?.value,
        acceptLanguage: request.headers.get("accept-language"),
      });
      return new NextResponse(MESSAGES[locale].common.serviceUnavailable, {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  }

  const headers = new Headers(request.headers);
  const policy = production && env ? contentSecurityPolicy(env) : undefined;
  if (policy) headers.set("Content-Security-Policy", policy);

  const response =
    session && env
      ? await updateSession(request, headers, env)
      : NextResponse.next({ request: { headers } });
  if (policy) response.headers.set("Content-Security-Policy", policy);
  return response;
}

function contentSecurityPolicy(env: SupabaseEnv) {
  const nonce = randomBytes(16).toString("base64");
  const supabase = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self'",
    // The document preview sets alignment through a React style attribute.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabase}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export const config = {
  matcher: [
    "/((?!api/health$|_next/static/|_next/image$|favicon.ico$|icon.svg$).*)",
  ],
};
