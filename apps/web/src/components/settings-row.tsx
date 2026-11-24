import type { ReactNode } from "react";

/** A setting: what it is on the left, how to use it on the right. */
export function SettingsRow({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-x-10 gap-y-4 py-8 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
    >
      <div className="space-y-1.5">
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-ink-soft">{description}</p>
      </div>
      <div className="min-w-0 max-w-2xl">{children}</div>
    </section>
  );
}
