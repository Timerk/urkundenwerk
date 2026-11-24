import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

it("returns a git version when present without checking service configuration", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
  const sha = "a".repeat(40);
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok", version: sha });
});

it.each([undefined, "invalid-version"])(
  "omits an unavailable commit SHA (%s)",
  async (sha) => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);
    expect(await GET().json()).toEqual({ status: "ok", version: null });
  },
);
