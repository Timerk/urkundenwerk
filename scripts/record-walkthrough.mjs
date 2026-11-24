import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const web = new URL("../apps/web/", import.meta.url);
const require = createRequire(new URL("package.json", web));
const filename = "walkthrough.webp";
const target = new URL(`../docs/screenshots/${filename}`, import.meta.url);

execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
const scratch = mkdtempSync(join(tmpdir(), "urkundenwerk-walkthrough-"));

try {
  execFileSync(
    process.execPath,
    [
      require.resolve("@playwright/test/cli"),
      "test",
      "e2e/walkthrough.spec.ts",
      "--reporter=list",
      "--output",
      scratch,
    ],
    {
      cwd: web,
      env: { ...process.env, WALKTHROUGH: "1" },
      stdio: "inherit",
    },
  );

  const videos = readdirSync(scratch, { recursive: true }).filter((path) =>
    path.endsWith(".webm"),
  );
  if (videos.length !== 1) {
    throw new Error(`Expected one Playwright video, found ${videos.length}.`);
  }

  const animation = join(scratch, filename);
  execFileSync(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-ss",
      "0.4",
      "-i",
      join(scratch, videos[0]),
      "-vf",
      "fps=10,scale=1040:-1:flags=lanczos",
      "-c:v",
      "libwebp_anim",
      "-quality",
      "84",
      "-compression_level",
      "5",
      "-loop",
      "0",
      animation,
    ],
    { stdio: "inherit" },
  );

  const bytes = statSync(animation).size;
  if (bytes > 6_000_000) {
    throw new Error(`Walkthrough exceeds 6 MB (${bytes} bytes).`);
  }
  copyFileSync(animation, target);
  console.log(`Wrote docs/screenshots/${filename} (${bytes} bytes).`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
