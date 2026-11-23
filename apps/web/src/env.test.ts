import { describe, expect, it } from "vitest";
import { parseSupabaseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-for-tests",
};

describe("parseSupabaseEnv", () => {
  it("accepts a URL and a publishable key", () => {
    expect(parseSupabaseEnv(valid)).toEqual(valid);
  });

  it("ignores unrelated variables", () => {
    expect(parseSupabaseEnv({ ...valid, PATH: "/usr/bin" })).toEqual(valid);
  });

  it("names every missing variable", () => {
    expect(() => parseSupabaseEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL .*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required/,
    );
  });

  it("rejects a blank key", () => {
    expect(() =>
      parseSupabaseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " " }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required/);
  });

  it.each(["not a url", "ftp://127.0.0.1", "javascript:alert(1)"])(
    "rejects %s as the URL",
    (url) => {
      expect(() =>
        parseSupabaseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: url }),
      ).toThrow(/NEXT_PUBLIC_SUPABASE_URL must be an http\(s\) URL/);
    },
  );

  it("does not echo values in the error", () => {
    const sensitive = "value-that-must-not-leak";
    expect(() =>
      parseSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: sensitive,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(sensitive),
      }),
    );
  });
});
