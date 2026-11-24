import "server-only";
import { getTranslations } from "next-intl/server";
import type { Messages } from "../../i18n/messages";
import { AUTH_ERROR_VALUES } from "./schemas";

export type AuthErrorKey = keyof Messages["auth"]["errors"];

// Every key of `auth.errors`, so an unexpected Zod message is never looked up.
const AUTH_ERROR_KEYS: Record<AuthErrorKey, true> = {
  emailRequired: true,
  emailInvalid: true,
  passwordRequired: true,
  passwordTooLong: true,
  passwordChoose: true,
  passwordShort: true,
  passwordLong: true,
  firmRequired: true,
  firmShort: true,
  firmLong: true,
  invalidCredentials: true,
  signInFailed: true,
  weakPassword: true,
  signUpFailed: true,
  confirmEmail: true,
  firmFailed: true,
  firmLimit: true,
  demoFirmDisabled: true,
};

export function isAuthErrorKey(key: string): key is AuthErrorKey {
  return Object.hasOwn(AUTH_ERROR_KEYS, key);
}

/** Translates the message keys of the auth schemas in the request's language. */
export async function authErrorTranslator(): Promise<(key: string) => string> {
  const t = await getTranslations("auth.errors");
  return (key) => {
    if (!isAuthErrorKey(key)) return key;
    const values = Object.hasOwn(AUTH_ERROR_VALUES, key)
      ? AUTH_ERROR_VALUES[key as keyof typeof AUTH_ERROR_VALUES]
      : undefined;
    // The values are typed per key above; the dynamic key loses that link.
    return (t as unknown as (key: string, values?: object) => string)(
      key,
      values,
    );
  };
}
