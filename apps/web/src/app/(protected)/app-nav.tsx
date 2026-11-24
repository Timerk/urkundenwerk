"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  /** Paths, besides `href` itself, that belong to this item. */
  prefixes?: readonly string[];
};

function isCurrent(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  return (item.prefixes ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * The firm's sections, set as tabs along the bottom edge of the header. The
 * current one is underlined in ink and marked with `aria-current`.
 */
export function AppNav({
  label,
  items,
  className = "",
}: {
  label: string;
  items: readonly NavItem[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex h-full gap-4 sm:gap-5">
        {items.map((item) => {
          const current = isCurrent(pathname, item);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`-mb-px inline-flex items-center border-b-2 pt-0.5 text-sm whitespace-nowrap transition-colors ${
                  current
                    ? "border-ink font-medium text-ink"
                    : "border-transparent text-ink-soft hover:border-rule-strong hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Settings for the signed-in person, as opposed to the firm. */
export function AccountLink({ label }: { label: string }) {
  const current = usePathname() === "/app/account";
  return (
    <Link
      href="/app/account"
      aria-current={current ? "page" : undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-sm transition-colors hover:bg-desk hover:text-ink ${
        current ? "bg-desk font-medium text-ink" : "text-ink-soft"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
        <circle
          cx="8"
          cy="5.5"
          r="2.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M2.75 14c.6-2.6 2.7-4 5.25-4s4.65 1.4 5.25 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="max-sm:sr-only">{label}</span>
    </Link>
  );
}
