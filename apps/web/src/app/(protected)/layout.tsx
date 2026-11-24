import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "../../components/brand";
import { LanguageSwitcher } from "../../components/language-switcher";
import { Button } from "../../components/ui/button";
import { getVerifiedUser } from "../../lib/supabase/server";
import {
  getCurrentMembership,
  getMemberships,
} from "../../lib/tenants/memberships";
import { signOut } from "./actions";
import { TenantSwitcher } from "./tenant-switcher";
import Link from "next/link";

/**
 * Guards every route in this group. The proxy only redirects optimistically;
 * this check asks the Supabase Auth server.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getVerifiedUser();
  if (!user) {
    redirect("/login");
  }
  const memberships = await getMemberships();
  const current = await getCurrentMembership();
  const t = await getTranslations();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-rule bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:flex-nowrap sm:gap-x-6 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 max-sm:basis-full">
            <Link
              href="/app"
              className="inline-flex items-center gap-2.5 rounded-sm font-semibold tracking-tight text-ink"
            >
              <BrandMark />
              <span className="max-sm:sr-only">Urkundenwerk</span>
            </Link>
            {current ? (
              <>
                <span aria-hidden="true" className="h-6 w-px bg-rule" />
                {memberships.length > 1 ? (
                  <TenantSwitcher
                    currentTenantId={current.tenantId}
                    tenants={memberships.map((membership) => ({
                      ...membership,
                      role: t(`roles.${membership.role}`),
                    }))}
                  />
                ) : (
                  <p className="truncate text-sm">
                    <span className="font-medium">{current.name}</span>{" "}
                    <span className="text-ink-faint">
                      ({t(`roles.${current.role}`)})
                    </span>
                  </p>
                )}
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm max-sm:ml-auto">
            <span className="truncate text-ink-soft max-md:hidden">
              {user.email}
            </span>
            <LanguageSwitcher />
            <form action={signOut}>
              <Button type="submit" variant="quiet" size="sm">
                {t("common.signOut")}
              </Button>
            </form>
          </div>
        </div>
        <nav
          aria-label={t("common.appNavigation")}
          className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2 text-sm text-stamp sm:px-6"
        >
          {current ? (
            <Link className="underline underline-offset-2" href="/app/members">
              {t("members.title")}
            </Link>
          ) : null}
          {current?.role === "admin" ? (
            <Link className="underline underline-offset-2" href="/app/audit">
              {t("audit.title")}
            </Link>
          ) : null}
          <Link className="underline underline-offset-2" href="/app/account">
            {t("account.title")}
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
