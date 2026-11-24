import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { demoLogin } from "../../../lib/auth/demo";
import { isSignupEnabled } from "../../../lib/auth/signup";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: `${t("login")} · Urkundenwerk` };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("auth.login");
  const invite = (await searchParams).next === "invite";
  const demo = demoLogin();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <LoginForm
        invite={invite}
        accounts={demo?.accounts ?? []}
        passwordHint={demo?.showPassword ? demo.password : undefined}
      />
      {isSignupEnabled() ? (
        <p className="text-sm text-ink-soft">
          {t("newHere")}{" "}
          <Link
            href="/signup"
            className="font-medium text-ink underline underline-offset-2"
          >
            {t("signupLink")}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
