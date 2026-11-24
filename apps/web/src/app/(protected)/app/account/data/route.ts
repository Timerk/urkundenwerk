import { accountExport } from "../../../../../lib/auth/account";
import {
  createClient,
  getVerifiedUser,
} from "../../../../../lib/supabase/server";

export async function GET() {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  const user = await getVerifiedUser();
  if (!user) return new Response(null, { status: 401, headers });

  const client = await createClient();
  const { data, error } = await client.rpc("export_my_account");
  const account = accountExport.safeParse(data);
  if (error || !account.success || account.data.profile.id !== user.id) {
    return new Response(null, { status: 500, headers });
  }

  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set(
    "Content-Disposition",
    'attachment; filename="urkundenwerk-account.json"',
  );
  return new Response(JSON.stringify(account.data, null, 2) + "\n", {
    headers,
  });
}
