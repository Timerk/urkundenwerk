import { describe, expect, it } from "vitest";
import { invalidFormState, readFields } from "./form-state";
import { loginSchema } from "./schemas";

describe("readFields", () => {
  it("reads text fields and ignores files and missing fields", () => {
    const formData = new FormData();
    formData.set("email", "anna.admin@demo.test");
    formData.set("password", new Blob(["x"]));

    expect(readFields(formData, ["email", "password", "firmName"])).toEqual({
      email: "anna.admin@demo.test",
      password: undefined,
      firmName: undefined,
    });
  });
});

describe("invalidFormState", () => {
  it("translates field errors and drops missing values", () => {
    const result = loginSchema.safeParse({ email: "anna" });
    if (result.success) {
      throw new Error("expected validation to fail");
    }

    expect(
      invalidFormState(
        result.error,
        { email: "anna", other: undefined },
        (key) => `<${key}>`,
      ),
    ).toEqual({
      fieldErrors: {
        email: ["<emailInvalid>"],
        password: ["<passwordRequired>"],
      },
      values: { email: "anna" },
    });
  });
});
