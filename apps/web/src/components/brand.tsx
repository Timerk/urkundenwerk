import Link from "next/link";

/** The mark: a letter written above a dotted blank, as on a statutory form. */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className}>
      <rect width="32" height="32" rx="6" fill="#18213a" />
      <path
        d="M10.5 7.5v8.25a5.5 5.5 0 0 0 11 0V7.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M7.5 26h17"
        stroke="#8ea3e8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.1 3.6"
      />
    </svg>
  );
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 rounded-sm text-lg font-semibold tracking-tight text-ink"
    >
      <BrandMark />
      <span>Urkundenwerk</span>
    </Link>
  );
}
