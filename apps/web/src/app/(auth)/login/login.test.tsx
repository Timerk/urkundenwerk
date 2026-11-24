import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { type DemoAccounts, demoLogin } from "../../../lib/auth/demo";
import { initialFormState } from "../../../lib/auth/form-state";
import { withIntl } from "../../../test/i18n";
import { signIn } from "./actions";
import LoginPage from "./page";

const { signInWithPassword, loginForm } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  loginForm: vi.fn<(props: unknown) => null>(() => null),
}));
vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword } }),
}));
vi.mock("next-intl/server", async () =>
  (await import("../../../test/i18n")).serverIntl(),
);
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect ${path}`);
  },
}));
vi.mock("./login-form", () => ({ LoginForm: loginForm }));

const hostedPassword = "fixture-password-only-on-server";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("DEMO_LOGIN_PASSWORD", hostedPassword);
  signInWithPassword.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

it("only accepts listed accounts for hosted one-click login", async () => {
  const form = new FormData();
  form.set("demo", "anna.admin@demo.test");
  form.set("email", "erik.editor@demo.test");
  form.set("password", "irrelevant");
  expect(await signIn(initialFormState, form)).toMatchObject({
    error: expect.any(String),
  });
  expect(signInWithPassword).not.toHaveBeenCalled();

  form.set("demo", "victor.viewer@demo.test");
  await expect(signIn(initialFormState, form)).rejects.toThrow("redirect /app");
  expect(signInWithPassword).toHaveBeenCalledExactlyOnceWith({
    email: "victor.viewer@demo.test",
    password: hostedPassword,
  });
});

it("signs the sandbox admin in with the shared hosted password", async () => {
  const form = new FormData();
  form.set("demo", "sara.admin@demo.test");
  await expect(signIn(initialFormState, form)).rejects.toThrow("redirect /app");
  expect(signInWithPassword).toHaveBeenCalledExactlyOnceWith({
    email: "sara.admin@demo.test",
    password: hostedPassword,
  });
});

it("passes only public account details from the hosted page to the client component", async () => {
  const markup = renderToStaticMarkup(
    withIntl(
      await LoginPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({}),
      }),
    ),
  );
  expect(markup).not.toContain(hostedPassword);
  expect(loginForm.mock.lastCall?.[0]).toEqual({
    accounts: [
      { email: "erik.editor@demo.test", description: "erik" },
      { email: "victor.viewer@demo.test", description: "victor" },
      { email: "sara.admin@demo.test", description: "saraSandbox" },
      { email: "mia.multi@demo.test", description: "mia" },
    ],
    passwordHint: undefined,
    invite: false,
  });
});

it("describes Sara by the firm each environment seeds", () => {
  const hosted = demoLogin();
  vi.stubEnv("DEMO_LOGIN_PASSWORD", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  const local = demoLogin();
  const sara = (accounts: DemoAccounts = []) =>
    accounts.find(({ email }) => email === "sara.admin@demo.test")?.description;
  expect(sara(hosted?.accounts)).toBe("saraSandbox");
  expect(sara(local?.accounts)).toBe("sara");
});
