import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: `${t("signup")} · Urkundenwerk` };
}

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-ink-soft">{t("intro")}</p>
      </div>
      <SignupForm />
      <p className="text-sm text-ink-soft">
        {t("registered")}{" "}
        <Link
          href="/login"
          className="font-medium text-ink underline underline-offset-2"
        >
          {t("loginLink")}
        </Link>
      </p>
    </section>
  );
}
