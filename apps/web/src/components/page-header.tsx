import type { ReactNode } from "react";

/**
 * The heading of a settings or list page: what the page is, and whose data
 * it shows. Actions sit to the right and wrap below on narrow screens.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-sm text-ink-soft [overflow-wrap:anywhere]">
            {description}
          </p>
        ) : null}
      </div>
      {actions}
    </header>
  );
}
