import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AuditList, auditActionKey } from "../../../../components/audit-list";
import { Button, buttonClasses } from "../../../../components/ui/button";
import { Field, Select, TextInput } from "../../../../components/ui/field";
import {
  AUDIT_ACTIONS,
  auditActionSchema,
} from "../../../../lib/audit/presentation";
import { listAudit } from "../../../../lib/audit/repository";
import { createClient } from "../../../../lib/supabase/server";
import { getCurrentMembership } from "../../../../lib/tenants/memberships";

const PAGE_SIZE = 25;
const pageSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .transform(Number)
  .pipe(z.int().max(1_000_000));

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
  const result = invalidDocument
    ? { entries: [], hasNext: false }
    : await listAudit(await createClient(), {
        tenantId: membership.tenantId,
        action,
        documentId,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });

  function pageLink(number: number) {
    const query = new URLSearchParams({ page: String(number) });
    if (action) query.set("action", action);
    if (documentId) query.set("document", documentId);
    return `/app/audit?${query}`;
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-ink-soft">{membership.name}</p>
      </div>
      <form
        action="/app/audit"
        className="grid items-start gap-3 rounded-md border border-rule bg-paper p-4 sm:grid-cols-[1fr_1fr_auto]"
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
        <Field
          label={t("documentFilter")}
          error={invalidDocument ? t("invalidDocument") : undefined}
        >
          {(ids) => (
            <TextInput
              ids={ids}
              name="document"
              defaultValue={
                typeof params.document === "string" ? params.document : ""
              }
              maxLength={36}
            />
          )}
        </Field>
        <Button type="submit" className="sm:mt-6">
          {t("filter")}
        </Button>
      </form>
      <div className="rounded-md border border-rule bg-paper px-4">
        <AuditList entries={result.entries} linkDocuments />
      </div>
      {!invalidDocument && (page > 1 || result.hasNext) ? (
        <nav
          aria-label={t("pages")}
          className="flex flex-wrap items-center justify-between gap-2"
        >
          {page > 1 ? (
            <Link
              className={buttonClasses({ variant: "secondary" })}
              href={pageLink(page - 1)}
            >
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink-soft">{t("page", { page })}</span>
          {result.hasNext ? (
            <Link
              className={buttonClasses({ variant: "secondary" })}
              href={pageLink(page + 1)}
            >
              {t("next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
