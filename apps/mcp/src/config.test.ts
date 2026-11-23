import { describe, expect, it } from "vitest";
import { isPrivilegedKey, parseConfig } from "./config";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  URKUNDENWERK_EMAIL: "erik.editor@demo.test",
  URKUNDENWERK_PASSWORD: "not-a-real-password",
};

function jwt(payload: object): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(payload)}.signature`;
}

describe("parseConfig", () => {
  it("accepts the publishable key and user credentials", () => {
    expect(parseConfig(valid)).toEqual({
      supabaseUrl: valid.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      email: valid.URKUNDENWERK_EMAIL,
      password: valid.URKUNDENWERK_PASSWORD,
      exportDir: undefined,
    });
  });

  it("names missing variables without echoing values", () => {
    expect(() =>
      parseConfig({
        ...valid,
        URKUNDENWERK_PASSWORD: undefined,
        URKUNDENWERK_EMAIL: "nope",
      }),
    ).toThrow(
      /URKUNDENWERK_EMAIL must be an email address; URKUNDENWERK_PASSWORD is required/,
    );
    try {
      parseConfig({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "secret-value" });
    } catch (error) {
      expect((error as Error).message).not.toContain("secret-value");
    }
  });

  it("refuses secret and service-role keys", () => {
    for (const key of ["sb_secret_abc", jwt({ role: "service_role" })]) {
      expect(() =>
        parseConfig({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
      ).toThrow(/secret and service-role keys bypass row-level security/);
    }
    expect(isPrivilegedKey(jwt({ role: "anon" }))).toBe(false);
  });

  it("requires an absolute export directory", () => {
    expect(() =>
      parseConfig({ ...valid, URKUNDENWERK_EXPORT_DIR: "exports" }),
    ).toThrow(/absolute path/);
    expect(
      parseConfig({ ...valid, URKUNDENWERK_EXPORT_DIR: "" }).exportDir,
    ).toBeUndefined();
  });
});
