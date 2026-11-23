import { existsSync } from "node:fs";
import { cp } from "node:fs/promises";
import { URL } from "node:url";

const app = new URL("../", import.meta.url);
const standalone = new URL(".next/standalone/apps/web/", app);

await cp(new URL(".next/static/", app), new URL(".next/static/", standalone), {
  recursive: true,
});

const publicAssets = new URL("public/", app);
if (existsSync(publicAssets)) {
  await cp(publicAssets, new URL("public/", standalone), { recursive: true });
}
