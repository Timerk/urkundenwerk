import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { dayKey, formatDay, formatTime } from "../i18n/format";
import {
  changedFields,
  importTotals,
  type AuditEntry,
  type PersonLabel,
} from "../lib/audit/presentation";
import { isFieldPath, useFieldLabels } from "../lib/builder/fields";

/** How many changed fields an entry lists before it folds the rest away. */
const FIELDS_SHOWN = 5;

/** Events that took something away are marked in alert red on the rail. */
const REMOVALS: ReadonlySet<AuditEntry["action"]> = new Set([
  "document.deleted",
  "membership.removed",
]);

/**
 * Audit events as a timeline: one group per German calendar day, newest
 * first, with the time on the left and a rail that ties a day's events
 * together. Used on the audit page and in a document's activity panel.
 */
export function AuditList({
  entries,
  documents,
  dayHeading: DayHeading = "h3",
}: {
  entries: readonly AuditEntry[];
  /**
   * Titles of the firm's documents by ID. When given, each document event
   * names its document, opens it, and filters the log by it.
   */
  documents?: ReadonlyMap<string, string>;
  dayHeading?: "h2" | "h3";
}) {
  const t = useTranslations("audit");
  const locale = useLocale();
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));

  const groups: { key: string; entries: AuditEntry[] }[] = [];
  for (const entry of entries) {
    const key = dayKey(entry.occurredAt);
    const last = groups.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else groups.push({ key, entries: [entry] });
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const day = formatDay(locale, group.entries[0]!.occurredAt);
        const relative =
          group.key === today
            ? t("today")
            : group.key === yesterday
              ? t("yesterday")
              : null;
        return (
          <section key={group.key} aria-label={day}>
            <DayHeading className="mb-3 text-sm text-ink-soft">
              {relative ? (
                <>
                  <span className="font-medium text-ink">{relative}</span>
                  <span aria-hidden="true" className="mx-1.5 text-rule-strong">
                    /
                  </span>
                </>
              ) : null}
              {day}
            </DayHeading>
            <ol>
              {group.entries.map((entry) => (
                <AuditItem key={entry.id} entry={entry} documents={documents} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function AuditItem({
  entry,
  documents,
}: {
  entry: AuditEntry;
  documents?: ReadonlyMap<string, string>;
}) {
  const t = useTranslations("audit");
  const roles = useTranslations("roles");
  const locale = useLocale();
  const labels = useFieldLabels();
  const by = (label: PersonLabel) =>
    label.kind === "person"
      ? t("byPerson", { name: label.name })
      : label.kind === "former"
        ? t("byFormer")
        : t("byNone");
  const person = (label: PersonLabel) =>
    label.kind === "person" ? label.name : t(label.kind);

  const fields = changedFields(entry).flatMap((path) =>
    path === "title"
      ? [t("titleField")]
      : isFieldPath(path)
        ? [labels.label(path)]
        : [],
  );
  const details: ReactNode[] = [];
  if (entry.action.startsWith("membership."))
    details.push(t("member", { name: person(entry.subject) }));
  if (entry.action === "document.updated" && entry.details?.status)
    details.push(
      t("statusChange", {
        from: t(`statuses.${entry.details.status.from}`),
        to: t(`statuses.${entry.details.status.to}`),
      }),
    );
  if (entry.action === "membership.role_changed" && entry.details)
    details.push(
      t("roleChange", {
        from: roles(entry.details.from),
        to: roles(entry.details.to),
      }),
    );
  if (
    (entry.action === "membership.added" ||
      entry.action === "membership.removed") &&
    entry.details
  )
    details.push(t("roleNamed", { role: roles(entry.details.role) }));
  if (entry.action === "membership.removed" && entry.details?.reason)
    details.push(t("accountDeleted"));
  if (entry.action === "document.exported" && entry.details)
    details.push(
      t("exportDetails", {
        format: entry.details.format.toUpperCase(),
        document: t(`exportDocuments.${entry.details.document}`),
      }),
    );
  if (entry.action === "document.imported" && entry.details)
    details.push(
      t("importDetails", {
        ...importTotals(entry.details.counts),
        model: entry.details.model,
        version: entry.details.promptVersion,
      }),
    );

  const documentId = documents ? entry.documentId : null;
  const title = documentId ? documents?.get(documentId) : undefined;

  return (
    <li className="group/item grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2 sm:gap-x-3">
      <time
        dateTime={entry.occurredAt}
        className="pt-px text-sm text-ink-faint tabular-nums"
      >
        {formatTime(locale, entry.occurredAt)}
      </time>
      <div className="relative max-w-prose border-l border-rule pb-5 pl-4 group-last/item:pb-1">
        <span
          aria-hidden="true"
          className={`absolute top-[7px] -left-[4.5px] size-2 rounded-full ring-[3px] ring-paper ${
            REMOVALS.has(entry.action) ? "bg-alert" : "bg-stamp"
          }`}
        />
        <p className="text-sm [overflow-wrap:anywhere]">
          <span className="font-medium text-ink">
            {t(`actions.${auditActionKey(entry.action)}`)}
          </span>{" "}
          <span className="text-ink-soft">{by(entry.actor)}</span>
        </p>
        {details.map((detail, index) => (
          <p
            key={index}
            className="text-sm text-ink-soft [overflow-wrap:anywhere]"
          >
            {detail}
          </p>
        ))}
        {fields.length ? <ChangedFields fields={fields} /> : null}
        {documentId ? (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
            {title !== undefined ? (
              <Link
                href={`/app/documents/${documentId}`}
                className="font-serif text-base text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
              >
                {title}
              </Link>
            ) : (
              <span className="text-ink-faint">{t("deletedDocument")}</span>
            )}
            <Link
              href={`/app/audit?document=${documentId}`}
              className="text-stamp underline decoration-stamp/30 underline-offset-4 hover:decoration-stamp"
              aria-label={`${t("onlyDocument")}: ${title ?? t("deletedDocument")}`}
            >
              {t("onlyDocument")}
            </Link>
          </p>
        ) : null}
      </div>
    </li>
  );
}

function ChangedFields({ fields }: { fields: string[] }) {
  const t = useTranslations("audit");
  const shown = fields.slice(0, FIELDS_SHOWN);
  const rest = fields.slice(FIELDS_SHOWN);
  return (
    <div className="text-sm text-ink-soft">
      <span>{t("fieldsLabel")} </span>
      <span className="text-ink">{shown.join(", ")}</span>
      {rest.length ? " " : null}
      {rest.length ? (
        <details className="inline [&[open]>summary]:hidden">
          <summary className="inline cursor-pointer list-none text-stamp underline decoration-stamp/30 underline-offset-4 hover:decoration-stamp [&::-webkit-details-marker]:hidden">
            {t("moreFields", { count: rest.length })}
          </summary>
          <span className="text-ink">, {rest.join(", ")}</span>
        </details>
      ) : null}
    </div>
  );
}

type ReplaceAction<A extends string> =
  A extends `${infer Entity}.${infer Action}` ? `${Entity}_${Action}` : never;

export function auditActionKey<A extends AuditEntry["action"]>(action: A) {
  return action.replace(".", "_") as ReplaceAction<A>;
}
