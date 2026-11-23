import { expect, it } from "vitest";
import { LruCache } from "./lru";

it("evicts the least recently used entry", () => {
  const cache = new LruCache<number>(2);
  cache.set("a", 1);
  cache.set("b", 2);
  expect(cache.get("a")).toBe(1);
  cache.set("c", 3);

  expect(cache.get("b")).toBeUndefined();
  expect(cache.get("a")).toBe(1);
  expect(cache.get("c")).toBe(3);
  expect(cache.size).toBe(2);
});

it("rejects a capacity below one", () => {
  expect(() => new LruCache(0)).toThrow(RangeError);
});
