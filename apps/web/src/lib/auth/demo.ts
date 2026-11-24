import "server-only";

// The hosted accounts have only editor or viewer access. Local Supabase also
// provides an admin for exercising the firm management flow.
const SHARED_ACCOUNTS = [
  { email: "erik.editor@demo.test", description: "erik" },
  { email: "victor.viewer@demo.test", description: "victor" },
  { email: "mia.multi@demo.test", description: "mia" },
] as const;

export function demoLogin(env = process.env) {
  if (env.DEMO_LOGIN_PASSWORD) {
    return { accounts: SHARED_ACCOUNTS, password: env.DEMO_LOGIN_PASSWORD };
  }
  const host = URL.parse(env.NEXT_PUBLIC_SUPABASE_URL ?? "")?.hostname;
  if (
    env.VERCEL !== "1" &&
    (host === "127.0.0.1" ||
      host === "localhost" ||
      host === "host.docker.internal")
  ) {
    return {
      accounts: [
        ...SHARED_ACCOUNTS.slice(0, 2),
        { email: "sara.admin@demo.test", description: "sara" } as const,
        SHARED_ACCOUNTS[2],
      ],
      password: "demo-password-123",
      showPassword: true,
    };
  }
  return null;
}

export type DemoAccounts = NonNullable<
  ReturnType<typeof demoLogin>
>["accounts"];
