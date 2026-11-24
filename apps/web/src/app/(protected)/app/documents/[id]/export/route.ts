import { getLocale, getTranslations } from "next-intl/server";
import { ruleMessage } from "../../../../../../i18n/rule-messages";
import { todayInGermany } from "../../../../../../lib/dates";
import { exportDocument } from "../../../../../../lib/documents/export";
import {
  createClient,
  getVerifiedUser,
} from "../../../../../../lib/supabase/server";

// PDFKit and the font file need Node APIs; exports are personal and never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /app/documents/:id/export?format=pdf|docx|xml&document=musterprotokoll|anmeldung` */
export async function GET(
  request: Request,
  { params }: RouteContext<"/app/documents/[id]/export">,
) {
  const { id } = await params;
  const user = await getVerifiedUser();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  // Error codes stay stable; their messages follow the UI language.
  const t = await getTranslations("rules");
  const locale = await getLocale();
  return exportDocument(supabase, user?.id ?? null, {
    id,
    format: searchParams.get("format"),
    document: searchParams.get("document"),
    referenceDate: todayInGermany(),
    describe: (issue) => ruleMessage(t, locale, issue),
  });
}
