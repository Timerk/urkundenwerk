import { exportDocument } from "../../../../../../lib/documents/export";
import {
  createClient,
  getVerifiedUser,
} from "../../../../../../lib/supabase/server";

// PDFKit and the font file need Node APIs; exports are personal and never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /app/documents/:id/export?format=pdf|docx` */
export async function GET(
  request: Request,
  { params }: RouteContext<"/app/documents/[id]/export">,
) {
  const { id } = await params;
  const user = await getVerifiedUser();
  const supabase = await createClient();
  return exportDocument(supabase, user?.id ?? null, {
    id,
    format: new URL(request.url).searchParams.get("format"),
  });
}
