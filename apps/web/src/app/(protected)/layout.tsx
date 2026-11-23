import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "../../components/brand";
import { Button } from "../../components/ui/button";
import { getVerifiedUser } from "../../lib/supabase/server";
import {
  getCurrentMembership,
  getMemberships,
} from "../../lib/tenants/memberships";
import { ROLE_LABELS } from "../../lib/tenants/selection";
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

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col">
      <header className="border-b border-rule bg-paper">
        <div className="flex items-center justify-between gap-x-4 px-4 py-2.5 sm:gap-x-6 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
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
                      role: ROLE_LABELS[membership.role],
                    }))}
                  />
                ) : (
                  <p className="truncate text-sm">
                    <span className="font-medium">{current.name}</span>{" "}
                    <span className="text-ink-faint">
                      ({ROLE_LABELS[current.role]})
                    </span>
                  </p>
                )}
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <span className="truncate text-ink-soft max-sm:hidden">
              {user.email}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="quiet" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
