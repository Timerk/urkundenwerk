import { createServerClient } from "@supabase/ssr";
import type { Database } from "@urkundenwerk/core/db";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseEnv } from "../../env";

const PROTECTED_PREFIX = "/app";
const AUTH_PAGES = new Set(["/login", "/signup"]);

/**
 * Refreshes the Supabase session cookies and redirects optimistically based on
 * the JWT claims. Pages still verify the user with the Auth server before
 * showing protected data.
 */
export function usesSession(pathname: string) {
  return isProtectedPath(pathname) || AUTH_PAGES.has(pathname);
}

function isProtectedPath(pathname: string) {
  return (
    pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`)
  );
}

export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
  env: SupabaseEnv,
) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // getClaims() validates the JWT and refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = typeof data?.claims.sub === "string";
  const { pathname } = request.nextUrl;

  if (!isSignedIn && isProtectedPath(pathname)) {
    return redirectKeepingCookies(request, response, "/login");
  }
  if (isSignedIn && AUTH_PAGES.has(pathname)) {
    return redirectKeepingCookies(request, response, "/app");
  }
  return response;
}

function redirectKeepingCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
