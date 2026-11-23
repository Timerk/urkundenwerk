import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "../../../../components/ui/button";
import { Notice } from "../../../../components/ui/notice";
import { aiState } from "../../../../lib/ai/state";
import { getCurrentMembership } from "../../../../lib/tenants/memberships";
import {
  canEditDocuments,
  ROLE_LABELS,
} from "../../../../lib/tenants/selection";
import { ImportFlow } from "./import-flow";

export const metadata: Metadata = {
  title: "Import from contract · Urkundenwerk",
};

function Unavailable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl text-ink">Import from a contract</h1>
      <Notice title={title}>{children}</Notice>
      <Link href="/app" className={buttonClasses({ variant: "secondary" })}>
        Back to documents
      </Link>
    </div>
  );
}

export default async function ImportPage() {
  const membership = await getCurrentMembership();
  if (!membership || !canEditDocuments(membership.role)) {
    return (
      <Unavailable title="Importing needs the editor or admin role">
        {membership
          ? `Your role in ${membership.name} is ${ROLE_LABELS[membership.role]}. Ask an admin of the firm to change it if you need to import contracts.`
          : "Create or join a firm first."}
      </Unavailable>
    );
  }

  const state = aiState();
  if (!state.ok || !state.extractClient) {
    return (
      <Unavailable title="AI extraction is not configured on this server">
        Importing reads a contract with an AI model, and this server has no
        model set up. You can still start a new Musterprotokoll and fill it in
        by hand. To try the import locally, set <code>ANTHROPIC_API_KEY</code>,{" "}
        <code>OPENAI_API_KEY</code>, or <code>AI_PROVIDER=fake</code> in{" "}
        <code>apps/web/.env.local</code>.
      </Unavailable>
    );
  }

  return (
    <ImportFlow
      tenantId={membership.tenantId}
      firmName={membership.name}
      provider={state.extractClient.provider}
      model={state.config.models.extract}
    />
  );
}
