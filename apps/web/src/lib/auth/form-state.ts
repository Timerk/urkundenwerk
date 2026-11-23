import { z } from "zod";

/** State returned by form Server Actions to `useActionState`. */
export type FormState = {
  /** A message about the whole form, such as rejected credentials. */
  error?: string;
  /** A neutral status message, such as a pending email confirmation. */
  notice?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  /** Submitted values to show again. Never includes passwords. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

/** Reads text fields from a form submission; missing fields become `undefined`. */
export function readFields<Key extends string>(
  formData: FormData,
  keys: readonly Key[],
): Record<Key, string | undefined> {
  const fields = {} as Record<Key, string | undefined>;
  for (const key of keys) {
    const value = formData.get(key);
    fields[key] = typeof value === "string" ? value : undefined;
  }
  return fields;
}

export function invalidFormState(
  error: z.ZodError,
  values: Record<string, string | undefined>,
): FormState {
  return {
    fieldErrors: z.flattenError(error).fieldErrors,
    values: withoutUndefined(values),
  };
}

export function withoutUndefined(
  values: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}
