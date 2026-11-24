import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("fails at request time when production Supabase configuration is missing", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await proxy(
    new NextRequest("https://demo.example/", {
      headers: { "Accept-Language": "en" },
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).toContain(
    "missing valid Supabase configuration",
  );
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringMatching(
        /NEXT_PUBLIC_SUPABASE_URL .*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
      ),
    }),
  );
});
