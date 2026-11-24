import { z } from "zod";

// Error messages are keys of `auth.errors` in the catalogues. The Server
// Actions translate them in the request's language (`invalidFormState`).

// Supabase Auth hashes passwords with bcrypt, which reads at most 72 bytes.
const MAX_PASSWORD_LENGTH = 72;
const MIN_PASSWORD_LENGTH = 8;
const MIN_FIRM_NAME = 2;
const MAX_FIRM_NAME = 120;

/** The values the error messages mention, by key. */
export const AUTH_ERROR_VALUES = {
  passwordShort: { min: MIN_PASSWORD_LENGTH },
  passwordLong: { max: MAX_PASSWORD_LENGTH },
  firmShort: { min: MIN_FIRM_NAME },
  firmLong: { max: MAX_FIRM_NAME },
} as const;

const email = z
  .string({ error: "emailRequired" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "emailInvalid" }));

/** Matches the length check on `public.tenants.name`. */
export const firmNameSchema = z
  .string({ error: "firmRequired" })
  .trim()
  .min(MIN_FIRM_NAME, { error: "firmShort" })
  .max(MAX_FIRM_NAME, { error: "firmLong" });

export const loginSchema = z.object({
  email,
  password: z
    .string({ error: "passwordRequired" })
    .min(1, { error: "passwordRequired" })
    .max(MAX_PASSWORD_LENGTH, { error: "passwordTooLong" }),
});

export const signupSchema = z.object({
  firmName: firmNameSchema,
  email,
  password: z
    .string({ error: "passwordChoose" })
    .min(MIN_PASSWORD_LENGTH, { error: "passwordShort" })
    .max(MAX_PASSWORD_LENGTH, { error: "passwordLong" }),
});

export const createFirmSchema = z.object({ firmName: firmNameSchema });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
