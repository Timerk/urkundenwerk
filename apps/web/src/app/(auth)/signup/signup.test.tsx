import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { initialFormState } from "../../../lib/auth/form-state";
import { withIntl } from "../../../test/i18n";
import { signUp } from "./actions";
import SignupPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));

afterEach(() => vi.unstubAllEnvs());

it("disables both the page and the sign-up action", async () => {
  vi.stubEnv("NEXT_PUBLIC_SIGNUP_ENABLED", "false");
  expect(() => renderToStaticMarkup(withIntl(<SignupPage />))).toThrow(
    "not found",
  );
  await expect(signUp(initialFormState, new FormData())).rejects.toThrow(
    "not found",
  );
});
