import { z } from "zod";

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));

// Supabase Auth hashes passwords with bcrypt, which reads at most 72 bytes.
const MAX_PASSWORD_LENGTH = 72;

/** Matches the length check on `public.tenants.name`. */
export const firmNameSchema = z
  .string({ error: "Enter the name of your firm." })
  .trim()
  .min(2, { error: "The firm name needs at least 2 characters." })
  .max(120, { error: "The firm name can have at most 120 characters." });

export const loginSchema = z.object({
  email,
  password: z
    .string({ error: "Enter your password." })
    .min(1, { error: "Enter your password." })
    .max(MAX_PASSWORD_LENGTH, { error: "The password is too long." }),
});

export const signupSchema = z.object({
  firmName: firmNameSchema,
  email,
  password: z
    .string({ error: "Choose a password." })
    .min(8, { error: "Use at least 8 characters." })
    .max(MAX_PASSWORD_LENGTH, {
      error: `Use at most ${MAX_PASSWORD_LENGTH} characters.`,
    }),
});

export const createFirmSchema = z.object({ firmName: firmNameSchema });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
