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

/**
 * Field errors in the request's language. Schemas carry message keys, and
 * `translate` turns each key into a sentence.
 */
export function invalidFormState(
  error: z.ZodError,
  values: Record<string, string | undefined>,
  translate: (key: string) => string,
): FormState {
  const fieldErrors = z.flattenError(error).fieldErrors as Partial<
    Record<string, string[]>
  >;
  return {
    fieldErrors: Object.fromEntries(
      Object.entries(fieldErrors).map(([field, keys]) => [
        field,
        keys?.map(translate),
      ]),
    ),
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
