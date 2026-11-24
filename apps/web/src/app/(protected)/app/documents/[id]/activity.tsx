import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  auditActionKey,
  AuditList,
} from "../../../../../components/audit-list";
import { formatDateTime } from "../../../../../i18n/format";
import type { AuditEntry } from "../../../../../lib/audit/presentation";

/**
 * The document's recent history, folded away beside the checks. Closed, it
 * still says what happened last; open, it shows the same timeline as the
 * firm audit log.
 */
export function Activity({
  entries,
  more = false,
  auditHref,
}: {
  entries: AuditEntry[];
  /** Whether older entries exist than the ones shown. */
  more?: boolean;
  auditHref?: string;
}) {
  const t = useTranslations("audit");
  const locale = useLocale();
  const latest = entries[0];
  return (
    <details className="group/activity rounded-md border border-rule bg-paper">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-md px-4 py-3 hover:bg-surface group-open/activity:rounded-b-none group-open/activity:border-b group-open/activity:border-rule [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-3.5 text-ink-soft transition-transform group-open/activity:rotate-90"
          >
            <path
              d="M6 3.5 10.5 8 6 12.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-base font-semibold tracking-tight text-ink">
            {t("activity")}
          </span>
        </span>
        {latest ? (
          <span className="text-xs text-ink-faint">
            {t("latest", {
              action: t(`actions.${auditActionKey(latest.action)}`),
              date: formatDateTime(locale, latest.occurredAt),
            })}
          </span>
        ) : null}
      </summary>
      <div className="space-y-4 px-4 pt-4 pb-4">
        {entries.length ? (
          <AuditList entries={entries} />
        ) : (
          <p className="text-sm text-ink-soft">{t("emptyTitle")}</p>
        )}
        {more || auditHref ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-rule pt-3 text-sm">
            {more ? (
              <p className="text-ink-faint">
                {t("recentOnly", { count: entries.length })}
              </p>
            ) : (
              <span />
            )}
            {auditHref ? (
              <Link
                href={auditHref}
                className="font-medium text-stamp underline decoration-stamp/30 underline-offset-4 hover:decoration-stamp"
              >
                {t("openAudit")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
