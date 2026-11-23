import {
  musterprotokollDraftSchema,
  musterprotokollMetadata,
} from "@urkundenwerk/core";
import type { Metadata } from "next";
import Link from "next/link";
import { FormError } from "../../../components/form-error";
import { analyseDraft } from "../../../lib/builder/form-model";
import { todayInGermany } from "../../../lib/dates";
import {
  type DocumentSummary,
  listDocuments,
} from "../../../lib/documents/repository";
import { createClient } from "../../../lib/supabase/server";
import { getCurrentMembership } from "../../../lib/tenants/memberships";
import { canEditDocuments, ROLE_LABELS } from "../../../lib/tenants/selection";
import { CreateFirmForm } from "./create-firm-form";
import { DeleteDocumentButton } from "./delete-document-button";
import { NewDocumentForm } from "./new-document-form";

export const metadata: Metadata = { title: "Documents · Urkundenwerk" };

const TEMPLATE_LABELS: Record<string, string> = {
  [musterprotokollMetadata.id]: "Musterprotokoll, single founder",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

/** How far a draft is from export, counted as in the builder. */
function readiness(
  document: DocumentSummary,
  referenceDate: string,
): {
  ready: boolean;
  label: string;
} {
  const draft = musterprotokollDraftSchema.safeParse(document.data);
  if (!draft.success) return { ready: false, label: "Needs review" };
  const { complete, outstanding } = analyseDraft(draft.data, referenceDate);
  if (complete) return { ready: true, label: "Ready to export" };
  return {
    ready: false,
    label:
      outstanding === 1
        ? "1 field to complete"
        : `${outstanding} fields to complete`,
  };
}

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string | string[] }>;
}) {
  const membership = await getCurrentMembership();
  const { setup } = await searchParams;

  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up your firm
        </h1>
        {setup === "failed" ? (
          <FormError message="Your account was created, but setting up your firm failed. Please try again." />
        ) : null}
        <p className="max-w-prose text-ink-soft">
          You are not a member of a firm yet. Create one to start drafting. You
          become its admin and can invite colleagues later.
        </p>
        <CreateFirmForm />
      </div>
    );
  }

  const supabase = await createClient();
  const documents = await listDocuments(supabase, membership.tenantId);
  const today = todayInGermany();
  const canEdit = canEditDocuments(membership.role);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {membership.name}
          </h1>
          <p className="text-sm text-ink-soft">
            Your role: {ROLE_LABELS[membership.role]}.{" "}
            {canEdit
              ? "You can create, edit, and delete documents."
              : "You can open and download documents."}
          </p>
        </div>
        {canEdit ? <NewDocumentForm tenantId={membership.tenantId} /> : null}
      </div>

      <section aria-labelledby="documents-heading" className="space-y-3">
        <h2
          id="documents-heading"
          className="text-sm font-medium text-ink-soft"
        >
          Documents
        </h2>
        {documents.length === 0 ? (
          <div className="rounded-md border border-dashed border-rule-strong bg-paper px-6 py-12 text-center">
            <p className="font-serif text-xl">No documents yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              {canEdit
                ? "Start a Musterprotokoll for a single-founder GmbH or UG. The deed fills in as you enter the case data."
                : "Documents that editors in this firm create will be listed here."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-rule bg-paper">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-rule bg-surface text-ink-soft">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Title
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium max-md:hidden"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium max-sm:hidden"
                  >
                    Last changed
                  </th>
                  {canEdit ? (
                    <th scope="col" className="px-4 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {documents.map((document) => {
                  const state = readiness(document, today);
                  const status = (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="rounded-xs border border-rule-strong px-1.5 py-px text-xs text-ink-soft">
                        {document.status === "draft" ? "Draft" : "Final"}
                      </span>
                      <span
                        className={state.ready ? "text-ok" : "text-ink-faint"}
                      >
                        {state.label}
                      </span>
                    </span>
                  );
                  return (
                    <tr key={document.id} className="group hover:bg-surface">
                      <td className="px-4 py-3.5 align-top">
                        <Link
                          href={`/app/documents/${document.id}`}
                          className="rounded-sm font-serif text-lg leading-snug text-ink underline-offset-4 group-hover:underline"
                        >
                          {document.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {TEMPLATE_LABELS[document.template_id] ??
                            document.template_id}
                        </p>
                        <div className="mt-2 space-y-1 text-xs md:hidden">
                          {status}
                          <p className="text-ink-faint sm:hidden">
                            {dateFormat.format(new Date(document.updated_at))}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top max-md:hidden">
                        {status}
                      </td>
                      <td className="px-4 py-3.5 align-top whitespace-nowrap text-ink-soft tabular-nums max-sm:hidden">
                        <time dateTime={document.updated_at}>
                          {dateFormat.format(new Date(document.updated_at))}
                        </time>
                      </td>
                      {canEdit ? (
                        <td className="px-4 py-2.5 text-right align-top">
                          <DeleteDocumentButton
                            documentId={document.id}
                            title={document.title}
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
