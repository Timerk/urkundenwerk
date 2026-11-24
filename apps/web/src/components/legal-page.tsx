import type { ReactNode } from "react";
import { Wordmark } from "./brand";
import { LanguageSwitcher } from "./language-switcher";

/**
 * A public page of legal information. The text keeps a reading measure;
 * on wide screens an optional table of contents sits to its left.
 */
export function LegalPage({
  title,
  lead,
  contents,
  children,
}: {
  title: string;
  lead?: ReactNode;
  contents?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-rule bg-paper">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark />
          <LanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div
          className={
            contents
              ? "grid gap-x-12 gap-y-8 lg:grid-cols-[13rem_minmax(0,1fr)]"
              : ""
          }
        >
          {contents ? (
            <div className="max-lg:hidden">
              <div className="sticky top-6">{contents}</div>
            </div>
          ) : null}
          <article className="max-w-[42rem] space-y-8">
            <header className="space-y-3">
              <h1 className="font-serif text-3xl leading-tight tracking-tight text-ink">
                {title}
              </h1>
              {lead ? <p className="text-base text-ink-soft">{lead}</p> : null}
            </header>
            {children}
          </article>
        </div>
      </main>
    </>
  );
}
