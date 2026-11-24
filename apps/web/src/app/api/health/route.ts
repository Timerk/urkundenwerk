export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return Response.json(
    { status: "ok", version: sha && /^[a-f0-9]{40}$/i.test(sha) ? sha : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
