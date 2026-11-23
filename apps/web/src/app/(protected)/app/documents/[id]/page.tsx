import {
  musterprotokollDraftSchema,
  musterprotokollMetadata,
} from "@urkundenwerk/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDocument } from "../../../../../lib/documents/repository";
import { documentIdSchema } from "../../../../../lib/documents/schemas";
import { createClient } from "../../../../../lib/supabase/server";
import { getMemberships } from "../../../../../lib/tenants/memberships";
import { canEditDocuments } from "../../../../../lib/tenants/selection";
import { Builder } from "./builder";

export const metadata: Metadata = { title: "Musterprotokoll · Urkundenwerk" };

export default async function DocumentPage({
  params,
}: PageProps<"/app/documents/[id]">) {
  const { id } = await params;
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

  return (
    <Builder
      documentId={document.id}
      title={document.title}
      initialDraft={draft.success ? draft.data : {}}
      updatedAt={document.updated_at}
      canEdit={canEditDocuments(membership.role)}
      firmName={membership.name}
      templateLabel="Musterprotokoll, single founder"
    />
  );
}
