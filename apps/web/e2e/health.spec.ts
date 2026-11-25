import { expect, test } from "@playwright/test";

test("the public health route reaches the database", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toMatchObject({ status: "ok", db: "ok" });
});
