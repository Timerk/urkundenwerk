"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "./locale";

/**
 * Stores the chosen UI language. Setting a cookie in a Server Action
 * re-renders the current page on the server while client state, such as
 * unsaved builder input, is kept.
 */
export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: LOCALE_COOKIE_MAX_AGE,
  });
}
