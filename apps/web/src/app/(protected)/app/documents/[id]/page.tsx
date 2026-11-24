import {
  musterprotokollDraftSchema,
  musterprotokollMetadata,
} from "@urkundenwerk/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isExplanationEnabled } from "../../../../../lib/ai/explanations";
import { todayInGermany } from "../../../../../lib/dates";
import { getDocument } from "../../../../../lib/documents/repository";
import { documentIdSchema } from "../../../../../lib/documents/schemas";
import { createClient } from "../../../../../lib/supabase/server";
import {
  getCurrentMembership,
  getMemberships,
} from "../../../../../lib/tenants/memberships";
import { canEditDocuments } from "../../../../../lib/tenants/selection";
import { Activity } from "./activity";
import { listAudit } from "../../../../../lib/audit/repository";
import { Builder } from "./builder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: `${t("document")} · Urkundenwerk` };
}

export default async function DocumentPage({
  params,
  searchParams,
}: PageProps<"/app/documents/[id]">) {
  const { id } = await params;
  const { imported } = await searchParams;
  const documentId = documentIdSchema.safeParse(id);
  if (!documentId.success) notFound();

  // RLS returns the document only to members of its firm; everyone else gets
  // the same 404 as for a document that does not exist.
  const supabase = await createClient();
  const document = await getDocument(supabase, documentId.data);
  const membership = (await getMemberships()).find(
    ({ tenantId }) => tenantId === document?.tenant_id,
  );
  if (!document || !membership) notFound();
  if (document.template_id !== musterprotokollMetadata.id) notFound();

  const draft = musterprotokollDraftSchema.safeParse(document.data);
  const t = await getTranslations("dashboard");

  const { entries, hasNext } = await listAudit(supabase, {
    tenantId: membership.tenantId,
    documentId: document.id,
    limit: 10,
  });
  const current = await getCurrentMembership();
  const auditHref =
    current?.tenantId === membership.tenantId && membership.role === "admin"
      ? `/app/audit?document=${document.id}`
      : undefined;
  return (
    <Builder
      activity={
        <Activity entries={entries} more={hasNext} auditHref={auditHref} />
      }
      documentId={document.id}
      title={document.title}
      initialDraft={draft.success ? draft.data : {}}
      updatedAt={document.updated_at}
      canEdit={canEditDocuments(membership.role)}
      firmName={membership.name}
      templateLabel={t("templateLabel")}
      referenceDate={todayInGermany()}
      aiEnabled={isExplanationEnabled()}
      imported={imported === "1"}
    />
  );
}
