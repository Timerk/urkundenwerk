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
import { AccountLink, AppNav, type NavItem } from "./app-nav";
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

  const items: NavItem[] = current
    ? [
        {
          href: "/app",
          label: t("common.documents"),
          prefixes: ["/app/documents", "/app/import"],
        },
        { href: "/app/members", label: t("members.title") },
        ...(current.role === "admin"
          ? [{ href: "/app/audit", label: t("audit.navLabel") }]
          : []),
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col">
      {/*
       * Left: the firm and its sections. Right: the person, their language,
       * and signing out. On wide screens this is one row; below `lg` the
       * sections move to a second row with the account link at its end.
       */}
      <header className="border-b border-rule bg-paper">
        <div className="flex flex-wrap items-center gap-x-4 px-4 sm:px-6 lg:h-14 lg:flex-nowrap lg:gap-x-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 sm:gap-4 lg:flex-none lg:py-0">
            <Link
              href="/app"
              className="inline-flex shrink-0 items-center gap-2.5 rounded-sm font-semibold tracking-tight text-ink"
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
                  <p className="min-w-0 truncate text-sm lg:max-w-80">
                    <span className="font-medium">{current.name}</span>
                    <span className="text-ink-faint max-sm:sr-only">
                      {" "}
                      ({t(`roles.${current.role}`)})
                    </span>
                  </p>
                )}
              </>
            ) : null}
          </div>
          <div className="order-last flex h-11 basis-full items-stretch justify-between gap-4 lg:contents">
            <AppNav
              label={t("common.appNavigation")}
              items={items}
              className="flex min-w-0 lg:h-full"
            />
            <div className="flex items-center gap-3 lg:ml-auto">
              <span
                className="max-w-64 truncate text-sm text-ink-faint max-xl:hidden"
                title={user.email}
              >
                {user.email}
              </span>
              <AccountLink label={t("account.title")} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 py-2.5 lg:py-0">
            <LanguageSwitcher />
            <form action={signOut}>
              <Button type="submit" variant="quiet" size="sm">
                {t("common.signOut")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
