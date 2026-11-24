import {
  musterprotokollDraftSchema,
  musterprotokollMetadata,
} from "@urkundenwerk/core";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Announcer } from "../../../components/announcer";
import { FormError } from "../../../components/form-error";
import { buttonClasses } from "../../../components/ui/button";
import { formatDateTime } from "../../../i18n/format";
import { analyseDraft } from "../../../lib/builder/form-model";
import { todayInGermany } from "../../../lib/dates";
import {
  type DocumentSummary,
  listDocuments,
} from "../../../lib/documents/repository";
import { createClient } from "../../../lib/supabase/server";
import { getCurrentMembership } from "../../../lib/tenants/memberships";
import { canEditDocuments } from "../../../lib/tenants/selection";
import { CreateFirmForm } from "./create-firm-form";
import { DocumentRow } from "./document-row";
import { NewDocumentForm } from "./new-document-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: `${t("documents")} · Urkundenwerk` };
}

/** How far a draft is from export, counted as in the builder. */
function readiness(
  document: DocumentSummary,
  referenceDate: string,
):
  | { state: "invalid" }
  | { state: "ready" }
  | { state: "outstanding"; count: number } {
  const draft = musterprotokollDraftSchema.safeParse(document.data);
  if (!draft.success) return { state: "invalid" };
  const { complete, outstanding } = analyseDraft(draft.data, referenceDate);
  return complete
    ? { state: "ready" }
    : { state: "outstanding", count: outstanding };
}

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string | string[] }>;
}) {
  const membership = await getCurrentMembership();
  const { setup } = await searchParams;
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("setupTitle")}
        </h1>
        {setup === "failed" ? <FormError message={t("setupFailed")} /> : null}
        <p className="max-w-prose text-ink-soft">{t("setupIntro")}</p>
        <CreateFirmForm />
      </div>
    );
  }

  const supabase = await createClient();
  const documents = await listDocuments(supabase, membership.tenantId);
  const today = todayInGermany();
  const canEdit = canEditDocuments(membership.role);
  const tRoles = await getTranslations("roles");
  const roles = (role: typeof membership.role) => tRoles(role);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {membership.name}
          </h1>
          <p className="text-sm text-ink-soft">
            {t("yourRole", { role: roles(membership.role) })}{" "}
            {canEdit ? t("canEdit") : t("canRead")}
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-start gap-2">
            <Link
              href="/app/import"
              className={buttonClasses({ variant: "secondary" })}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
                <path
                  d="M4 1.75h5.5L13 5.25v9H4zM9.25 1.75v3.75H13M8.5 12V7.75m0 0L6.5 9.75m2-2 2 2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("importContract")}
            </Link>
            <NewDocumentForm tenantId={membership.tenantId} />
          </div>
        ) : null}
      </div>

      <section aria-labelledby="documents-heading" className="space-y-3">
        <Announcer>
          <h2
            id="documents-heading"
            className="text-sm font-medium text-ink-soft"
          >
            {t("heading")}
          </h2>
          {documents.length === 0 ? (
            <div className="rounded-md border border-dashed border-rule-strong bg-paper px-6 py-12 text-center">
              <p className="font-serif text-xl">{t("emptyTitle")}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                {canEdit ? t("emptyEditor") : t("emptyViewer")}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-rule bg-paper">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-rule bg-surface text-ink-soft">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      {t("columns.title")}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 font-medium max-md:hidden"
                    >
                      {t("columns.status")}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 font-medium max-sm:hidden"
                    >
                      {t("columns.changed")}
                    </th>
                    {canEdit ? (
                      <th scope="col" className="px-4 py-2.5">
                        <span className="sr-only">{t("columns.actions")}</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {documents.map((document) => {
                    const state = readiness(document, today);
                    const changed = formatDateTime(locale, document.updated_at);
                    const status = (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span className="rounded-xs border border-rule-strong px-1.5 py-px text-xs text-ink-soft">
                          {document.status === "draft"
                            ? t("draft")
                            : t("final")}
                        </span>
                        <span
                          className={
                            state.state === "ready"
                              ? "text-ok"
                              : "text-ink-faint"
                          }
                        >
                          {state.state === "ready"
                            ? t("ready")
                            : state.state === "invalid"
                              ? t("needsReview")
                              : t("outstanding", { count: state.count })}
                        </span>
                      </span>
                    );
                    return (
                      <DocumentRow
                        key={document.id}
                        documentId={document.id}
                        title={document.title}
                        firmName={membership.name}
                        columns={canEdit ? 4 : 3}
                        canDelete={canEdit}
                      >
                        <td className="px-4 py-3.5 align-top">
                          <Link
                            href={`/app/documents/${document.id}`}
                            className="rounded-sm font-serif text-lg leading-snug text-ink underline-offset-4 group-hover:underline"
                          >
                            {document.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-ink-faint">
                            {document.template_id === musterprotokollMetadata.id
                              ? t("templateLabel")
                              : document.template_id}
                          </p>
                          <div className="mt-2 space-y-1 text-xs md:hidden">
                            {status}
                            <p className="text-ink-faint sm:hidden">
                              {changed}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-top max-md:hidden">
                          {status}
                        </td>
                        <td className="px-4 py-3.5 align-top whitespace-nowrap text-ink-soft tabular-nums max-sm:hidden">
                          <time dateTime={document.updated_at}>{changed}</time>
                        </td>
                      </DocumentRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Announcer>
      </section>
    </div>
  );
}
