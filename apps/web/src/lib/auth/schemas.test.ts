import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createFirmSchema, loginSchema, signupSchema } from "./schemas";

function fieldErrors(result: {
  error?: z.ZodError;
}): Partial<Record<string, string[]>> {
  return result.error ? z.flattenError(result.error).fieldErrors : {};
}

describe("loginSchema", () => {
  it("normalises the email address", () => {
    expect(
      loginSchema.parse({
        email: "  Anna.Admin@Demo.TEST ",
        password: "demo-password-123",
      }),
    ).toEqual({ email: "anna.admin@demo.test", password: "demo-password-123" });
  });

  it("keeps the password exactly as entered", () => {
    expect(
      loginSchema.parse({ email: "a@demo.test", password: " pass word " })
        .password,
    ).toBe(" pass word ");
  });

  it("reports missing fields", () => {
    expect(fieldErrors(loginSchema.safeParse({}))).toEqual({
      email: ["emailRequired"],
      password: ["passwordRequired"],
    });
  });

  it("rejects an invalid email address and an empty password", () => {
    expect(
      fieldErrors(loginSchema.safeParse({ email: "anna", password: "" })),
    ).toEqual({
      email: ["emailInvalid"],
      password: ["passwordRequired"],
    });
  });

  it("rejects passwords longer than bcrypt can hash", () => {
    const result = loginSchema.safeParse({
      email: "a@demo.test",
      password: "x".repeat(73),
    });
    expect(fieldErrors(result).password).toEqual(["passwordTooLong"]);
  });
});

describe("signupSchema", () => {
  const valid = {
    firmName: "  Demo-Kanzlei West ",
    email: "neu@demo.test",
    password: "demo-password-123",
  };

  it("trims the firm name", () => {
    expect(signupSchema.parse(valid).firmName).toBe("Demo-Kanzlei West");
  });

  it("requires a password of at least 8 characters", () => {
    expect(
      fieldErrors(signupSchema.safeParse({ ...valid, password: "short" }))
        .password,
    ).toEqual(["passwordShort"]);
  });

  it("matches the database length limits for firm names", () => {
    expect(
      fieldErrors(signupSchema.safeParse({ ...valid, firmName: " A " }))
        .firmName,
    ).toEqual(["firmShort"]);
    expect(
      signupSchema.safeParse({ ...valid, firmName: "x".repeat(120) }).success,
    ).toBe(true);
    expect(
      fieldErrors(
        signupSchema.safeParse({ ...valid, firmName: "x".repeat(121) }),
      ).firmName,
    ).toEqual(["firmLong"]);
  });
});

describe("createFirmSchema", () => {
  it("accepts a firm name with umlauts", () => {
    expect(createFirmSchema.parse({ firmName: "Kanzlei Süd" })).toEqual({
      firmName: "Kanzlei Süd",
    });
  });
});
