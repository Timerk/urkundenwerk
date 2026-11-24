import { readImportSample } from "../../../lib/import/samples";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/samples/[id]">,
) {
  const { id } = await params;
  const file = await readImportSample(id);
  if (!file) return new Response(null, { status: 404 });

  return new Response(file, {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${file.name}"`,
    },
  });
}
