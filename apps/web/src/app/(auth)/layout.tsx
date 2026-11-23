import type { ReactNode } from "react";
import { Wordmark } from "../../components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md space-y-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-20">
      <Wordmark />
      <div className="rounded-md border border-rule bg-paper px-5 py-7 sm:px-8">
        {children}
      </div>
    </main>
  );
}
