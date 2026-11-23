import Link from "next/link";
import type { ReactNode } from "react";
import { Disclaimer } from "../../components/disclaimer";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-sm space-y-8 px-6 py-16">
      <Link
        href="/"
        className="text-2xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        Urkundenwerk
      </Link>
      {children}
      <Disclaimer />
    </main>
  );
}
