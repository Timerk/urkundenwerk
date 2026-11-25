import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const { rpc, abortSignal } = vi.hoisted(() => ({
  rpc: vi.fn(),
  abortSignal:
    vi.fn<
      (signal: AbortSignal) => Promise<{ data: unknown; error: unknown }>
    >(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc })),
}));

const url = "https://demo.example.test";
const publishableKey = "sb_publishable_example";
const sha = "a".repeat(40);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishableKey);
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);
  rpc.mockReturnValue({ abortSignal });
  abortSignal.mockResolvedValue({ data: true, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("checks Supabase anonymously and returns the git version", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    status: "ok",
    db: "ok",
    version: sha,
  });
  expect(createClient).toHaveBeenCalledExactlyOnceWith(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("health_check");
});

it.each([undefined, "invalid-version"])(
  "omits an unavailable commit SHA (%s)",
  async (sha) => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);
    expect(await (await GET()).json()).toEqual({
      status: "ok",
      db: "ok",
      version: null,
    });
  },
);

it("returns degraded without exposing RPC error details", async () => {
  abortSignal.mockResolvedValue({
    data: null,
    error: { message: "Fictional upstream error" },
  });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    status: "degraded",
    db: "error",
    version: sha,
  });
});

it("aborts a stalled RPC after five seconds", async () => {
  vi.useFakeTimers();
  abortSignal.mockImplementation(
    (signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  );
  const pendingResponse = GET();
  await vi.advanceTimersByTimeAsync(4_999);
  const signal = abortSignal.mock.calls[0]?.[0];
  expect(signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(signal?.aborted).toBe(true);
  const response = await pendingResponse;
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    status: "degraded",
    db: "error",
    version: sha,
  });
});

it.each([false, "true", null])(
  "rejects an unexpected RPC payload (%s)",
  async (data) => {
    abortSignal.mockResolvedValue({ data, error: null });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "degraded",
      db: "error",
      version: sha,
    });
  },
);

it.each([undefined, "sb_secret_example"])(
  "skips the RPC without a publishable key (%s)",
  async (key) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "degraded",
      db: "unconfigured",
      version: sha,
    });
    expect(createClient).not.toHaveBeenCalled();
  },
);
