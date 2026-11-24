import { useTranslations } from "next-intl";

/** Shown at the top of every page by the root layout. */
export function DemoNotice() {
  const t = useTranslations("common");
  return (
    <div
      role="note"
      aria-label={t("demoNoticeLabel")}
      className="border-b border-hint-rule bg-hint-wash px-4 py-1.5 text-center text-xs text-hint"
    >
      <p>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="mr-1.5 inline-block size-3.5 -translate-y-px align-middle"
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 7.2v4M8 4.6v.1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {t("demoNotice")}
      </p>
    </div>
  );
}
