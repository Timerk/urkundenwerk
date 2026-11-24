import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AuditList, auditActionKey } from "../../../../components/audit-list";
import { PageHeader } from "../../../../components/page-header";
import { Button, buttonClasses } from "../../../../components/ui/button";
import { Field, Select } from "../../../../components/ui/field";
import { Notice } from "../../../../components/ui/notice";
import {
  AUDIT_ACTIONS,
  auditActionSchema,
} from "../../../../lib/audit/presentation";
import { listAudit } from "../../../../lib/audit/repository";
import { listDocuments } from "../../../../lib/documents/repository";
import { createClient } from "../../../../lib/supabase/server";
import { getCurrentMembership } from "../../../../lib/tenants/memberships";

const PAGE_SIZE = 25;
const pageSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .transform(Number)
  .pipe(z.int().max(1_000_000));

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("audit");
  return { title: `${t("title")} · Urkundenwerk` };
}

export default async function AuditPage({
  searchParams,
}: PageProps<"/app/audit">) {
  const membership = await getCurrentMembership();
  if (membership?.role !== "admin") notFound();

  const params = await searchParams;
  const action = auditActionSchema.safeParse(params.action).data;
  const documentId = z.uuid().safeParse(params.document).data;
  const invalidDocument =
    typeof params.document === "string" && !!params.document && !documentId;
  const page = pageSchema.safeParse(params.page).data ?? 1;
  const t = await getTranslations("audit");
  const client = await createClient();
  // Titles name the documents in the log; deleted ones have none.
  const [result, documents] = await Promise.all([
    invalidDocument
      ? { entries: [], hasNext: false }
      : listAudit(client, {
          tenantId: membership.tenantId,
          action,
          documentId,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        }),
    listDocuments(client, membership.tenantId),
  ]);
  const titles = new Map(documents.map(({ id, title }) => [id, title]));
  const filtered = Boolean(action || params.document);

  function pageLink(number: number) {
    const query = new URLSearchParams({ page: String(number) });
    if (action) query.set("action", action);
    if (documentId) query.set("document", documentId);
    return `/app/audit?${query}`;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <PageHeader
        title={t("title")}
        description={t("intro", { firm: membership.name })}
      />
      <form
        action="/app/audit"
        aria-label={t("filters")}
        className="grid items-end gap-3 rounded-md border border-rule bg-paper p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto_auto]"
      >
        <Field label={t("actionFilter")}>
          {(ids) => (
            <Select ids={ids} name="action" defaultValue={action ?? ""}>
              <option value="">{t("allActions")}</option>
              {AUDIT_ACTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`actions.${auditActionKey(value)}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("documentFilter")}>
          {(ids) => (
            <Select ids={ids} name="document" defaultValue={documentId ?? ""}>
              <option value="">{t("allDocuments")}</option>
              {documentId && !titles.has(documentId) ? (
                <option value={documentId}>
                  {t("deletedDocumentId", { id: documentId.slice(0, 8) })}
                </option>
              ) : null}
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit">{t("filter")}</Button>
        {filtered ? (
          <Link
            href="/app/audit"
            className={buttonClasses({ variant: "quiet" })}
          >
            {t("resetFilters")}
          </Link>
        ) : null}
      </form>

      {invalidDocument ? (
        <Notice tone="error">{t("invalidDocument")}</Notice>
      ) : result.entries.length ? (
        <section
          aria-label={t("entries")}
          className="rounded-md border border-rule bg-paper px-4 py-5 sm:px-6"
        >
          <AuditList
            entries={result.entries}
            documents={titles}
            dayHeading="h2"
          />
        </section>
      ) : (
        <div className="rounded-md border border-dashed border-rule-strong bg-paper px-6 py-12 text-center">
          <p className="font-serif text-xl">
            {filtered ? t("emptyFiltered") : t("emptyTitle")}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {filtered ? t("emptyFilteredHelp") : t("emptyHelp")}
          </p>
          {filtered ? (
            <Link
              href="/app/audit"
              className={`mt-4 ${buttonClasses({ variant: "secondary", size: "sm" })}`}
            >
              {t("resetFilters")}
            </Link>
          ) : null}
        </div>
      )}

      {!invalidDocument && (page > 1 || result.hasNext) ? (
        <nav
          aria-label={t("pages")}
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
        >
          <div>
            {page > 1 ? (
              <Link
                className={buttonClasses({ variant: "secondary", size: "sm" })}
                href={pageLink(page - 1)}
                rel="prev"
              >
                <Chevron direction="left" />
                {t("newer")}
              </Link>
            ) : null}
          </div>
          <p className="text-sm text-ink-soft">{t("page", { page })}</p>
          <div className="text-right">
            {result.hasNext ? (
              <Link
                className={buttonClasses({ variant: "secondary", size: "sm" })}
                href={pageLink(page + 1)}
                rel="next"
              >
                {t("older")}
                <Chevron direction="right" />
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
      <path
        d={
          direction === "left"
            ? "M10 3.5 5.5 8l4.5 4.5"
            : "M6 3.5 10.5 8 6 12.5"
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
