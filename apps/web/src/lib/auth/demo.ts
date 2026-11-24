import "server-only";

const ERIK = { email: "erik.editor@demo.test", description: "erik" } as const;
const VICTOR = {
  email: "victor.viewer@demo.test",
  description: "victor",
} as const;
const MIA = { email: "mia.multi@demo.test", description: "mia" } as const;

// Hosted visitors share these accounts. Sara administers only the West
// sandbox, which the nightly reset restores completely; Nord and Süd keep an
// operator-only admin. Local Supabase seeds Sara as admin of Süd instead.
const HOSTED_ACCOUNTS = [
  ERIK,
  VICTOR,
  { email: "sara.admin@demo.test", description: "saraSandbox" },
  MIA,
] as const;

const LOCAL_ACCOUNTS = [
  ERIK,
  VICTOR,
  { email: "sara.admin@demo.test", description: "sara" },
  MIA,
] as const;

export function demoLogin(env = process.env) {
  if (env.DEMO_LOGIN_PASSWORD) {
    return {
      accounts: HOSTED_ACCOUNTS as readonly DemoAccount[],
      password: env.DEMO_LOGIN_PASSWORD,
    };
  }
  const host = URL.parse(env.NEXT_PUBLIC_SUPABASE_URL ?? "")?.hostname;
  if (
    env.VERCEL !== "1" &&
    (host === "127.0.0.1" ||
      host === "localhost" ||
      host === "host.docker.internal")
  ) {
    return {
      accounts: LOCAL_ACCOUNTS as readonly DemoAccount[],
      password: "demo-password-123",
      showPassword: true,
    };
  }
  return null;
}

type DemoAccount =
  (typeof HOSTED_ACCOUNTS)[number] | (typeof LOCAL_ACCOUNTS)[number];

export type DemoAccounts = readonly DemoAccount[];
