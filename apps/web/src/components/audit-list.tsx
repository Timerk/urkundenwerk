import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { formatDateTime } from "../i18n/format";
import {
  changedFields,
  importTotals,
  type AuditEntry,
  type PersonLabel,
} from "../lib/audit/presentation";
import { isFieldPath, useFieldLabels } from "../lib/builder/fields";

export function AuditList({
  entries,
  linkDocuments = false,
}: {
  entries: readonly AuditEntry[];
  linkDocuments?: boolean;
}) {
  const t = useTranslations("audit");
  const roles = useTranslations("roles");
  const locale = useLocale();
  const labels = useFieldLabels();
  const person = (label: PersonLabel) =>
    label.kind === "person" ? label.name : t(label.kind);

  if (!entries.length)
    return <p className="py-3 text-sm text-ink-soft">{t("empty")}</p>;

  return (
    <ol className="divide-y divide-rule">
      {entries.map((entry) => {
        const fields = changedFields(entry).flatMap((path) =>
          path === "title"
            ? [t("titleField")]
            : isFieldPath(path)
              ? [labels.label(path)]
              : [],
        );
        return (
          <li
            key={entry.id}
            className="grid gap-x-4 gap-y-1 py-3 text-sm sm:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0 space-y-1 break-words">
              <p className="font-medium">
                {t(`actions.${auditActionKey(entry.action)}`)}
              </p>
              <p className="text-ink-soft">{person(entry.actor)}</p>
              {entry.action.startsWith("membership.") ? (
                <p className="text-ink-soft">
                  {t("member", { name: person(entry.subject) })}
                </p>
              ) : null}
              {fields.length ? <p>{fields.join(" · ")}</p> : null}
              {entry.action === "document.updated" && entry.details?.status ? (
                <p>
                  {t("change", {
                    from: t(`statuses.${entry.details.status.from}`),
                    to: t(`statuses.${entry.details.status.to}`),
                  })}
                </p>
              ) : null}
              {entry.action === "membership.role_changed" && entry.details ? (
                <p>
                  {t("change", {
                    from: roles(entry.details.from),
                    to: roles(entry.details.to),
                  })}
                </p>
              ) : null}
              {(entry.action === "membership.added" ||
                entry.action === "membership.removed") &&
              entry.details ? (
                <p>{roles(entry.details.role)}</p>
              ) : null}
              {entry.action === "document.exported" && entry.details ? (
                <p>{entry.details.format.toUpperCase()}</p>
              ) : null}
              {entry.action === "document.imported" && entry.details ? (
                <p>
                  {t("importDetails", {
                    ...importTotals(entry.details.counts),
                    model: entry.details.model,
                    version: entry.details.promptVersion,
                  })}
                </p>
              ) : null}
              {linkDocuments && entry.documentId ? (
                <Link
                  className="text-stamp underline underline-offset-2"
                  href={`/app/audit?document=${entry.documentId}`}
                >
                  {t("onlyDocument")}{" "}
                  <span className="font-mono text-xs">{entry.documentId}</span>
                </Link>
              ) : null}
            </div>
            <time className="text-ink-faint" dateTime={entry.occurredAt}>
              {formatDateTime(locale, entry.occurredAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

type ReplaceAction<A extends string> =
  A extends `${infer Entity}.${infer Action}` ? `${Entity}_${Action}` : never;

export function auditActionKey<A extends AuditEntry["action"]>(action: A) {
  return action.replace(".", "_") as ReplaceAction<A>;
}
