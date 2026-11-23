import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Disclaimer } from "../../components/disclaimer";
import { getVerifiedUser } from "../../lib/supabase/server";
import { signOut } from "./actions";

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

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-300 pb-4">
        <Link
          href="/app"
          className="text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Urkundenwerk
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-700">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-neutral-400 px-3 py-1.5 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="space-y-8 py-8">{children}</main>
      <footer className="border-t border-neutral-300 pt-4">
        <Disclaimer />
      </footer>
    </div>
  );
}
