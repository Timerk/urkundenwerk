import { expect, test } from "@playwright/test";

test.use({ locale: "de-DE", userAgent: "LinkedInBot/1.0" });

test("the landing page advertises a large social preview to crawlers", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const og = (property: string) =>
    page.locator(`head meta[property="og:${property}"]`);
  const twitter = (property: string) =>
    page.locator(`head meta[name="twitter:${property}"]`);

  await expect(og("title")).toHaveAttribute("content", "Urkundenwerk");
  await expect(og("description")).toHaveAttribute("content", /Musterprotokoll/);
  await expect(og("type")).toHaveAttribute("content", "website");
  await expect(og("site_name")).toHaveAttribute("content", "Urkundenwerk");
  await expect(og("locale")).toHaveAttribute("content", "de_DE");
  await expect(og("locale:alternate")).toHaveAttribute("content", "en_GB");
  await expect(twitter("card")).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(og("image")).toHaveAttribute(
    "content",
    /^https?:\/\/[^/]+\/opengraph-image(?:\?.*)?$/,
  );
  const imageUrl = (await og("image").getAttribute("content")) ?? "";
  await expect(twitter("image")).toHaveAttribute("content", imageUrl);
  await expect(og("image:alt")).toHaveAttribute("content", /fictional data/);

  // Fetch the advertised path on the server under test.
  const imagePath = new URL(imageUrl);
  const image = await request.get(imagePath.pathname + imagePath.search, {
    maxRedirects: 0,
  });
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  const png = await image.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test("robots and the favicon are available without a session", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt", { maxRedirects: 0 });
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toMatch(/^text\/plain\b/);
  expect((await robots.text()).trim().split(/\r?\n/)).toEqual([
    "User-Agent: *",
    "Allow: /",
    "Disallow: /app",
    "Disallow: /login",
    "Disallow: /signup",
    "Disallow: /invite",
  ]);

  const favicon = await request.get("/favicon.ico", { maxRedirects: 0 });
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()["content-type"]).toMatch(/^image\//);
});
