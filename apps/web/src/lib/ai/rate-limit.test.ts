import { expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

it("allows the limit per window and key, then recovers", () => {
  let now = 0;
  const limiter = new RateLimiter(2, 60_000, () => now);

  expect(limiter.take("a")).toBe(true);
  expect(limiter.take("a")).toBe(true);
  expect(limiter.take("a")).toBe(false);
  expect(limiter.take("b")).toBe(true);

  now = 59_999;
  expect(limiter.take("a")).toBe(false);
  now = 60_000;
  expect(limiter.take("a")).toBe(true);
});
