import { AuditList } from "../../../../../components/audit-list";
import { useTranslations } from "next-intl";
import type { AuditEntry } from "../../../../../lib/audit/presentation";
import Link from "next/link";

export function Activity({
  entries,
  auditHref,
}: {
  entries: AuditEntry[];
  auditHref?: string;
}) {
  const t = useTranslations("audit");
  return (
    <details className="rounded-md border border-rule bg-paper">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        {t("activity")}
      </summary>
      <div className="border-t border-rule px-4">
        <AuditList entries={entries} />
        {auditHref ? (
          <Link
            href={auditHref}
            className="mb-3 inline-block text-sm text-stamp underline underline-offset-2"
          >
            {t("openAudit")}
          </Link>
        ) : null}
      </div>
    </details>
  );
}
