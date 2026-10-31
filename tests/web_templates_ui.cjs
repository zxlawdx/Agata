const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  page.setDefaultTimeout(40000);
  const errors = [],
    metrics = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(process.env.AGATA_TEST_URL);
    await page.waitForSelector("[data-web-studio]");
    for (const template of [
      "saas-dashboard",
      "premium-landing",
      "creative-portfolio",
      "social-web",
      "ecommerce",
      "blog-editorial",
      "authentication-web",
      "admin-panel",
    ]) {
      const p = await page.evaluate(
        (template) =>
          window.pywebview.api.create_web_project(template, template),
        template,
      );
      const started = Date.now();
      await page.evaluate(
        (id) => window.Vela.navigate("/web", { project_id: id }),
        p.id,
      );
      await page.waitForFunction(
        (id) =>
          window.AgataWebSession?.project.id === id &&
          document.querySelector("#ws-files button"),
        p.id,
        { timeout: 40000 },
      );
      const openMs = Date.now() - started;
      await page.click("[data-mode=preview]");
      await page.waitForFunction(
        () => document.querySelector("#ws-preview").src.includes("/s/"),
        null,
        { timeout: 40000 },
      );
      await page
        .frameLocator("#ws-preview")
        .locator("main")
        .waitFor({ state: "attached" });
      const frame = page.frames().find((f) => f.url().includes("/s/"));
      await frame.waitForSelector("main");
      for (const width of [375, 1440]) {
        await page.selectOption("#ws-viewport", String(width));
        await page.waitForTimeout(200);
        const dimensions = await frame.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          main: !!document.querySelector("main"),
          background: getComputedStyle(document.documentElement)
            .backgroundColor,
        }));
        assert(dimensions.main);
        assert.equal(dimensions.width, width);
        assert(
          dimensions.scroll <= width + 2,
          template + " " + width + " overflow " + dimensions.scroll,
        );
        metrics.push({ template, width, openMs, ...dimensions });
        await frame.locator("body").screenshot({
          path: "/tmp/agata-template-" + template + "-" + width + ".png",
        });
      }
      console.log("Template responsive:", template);
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      "/tmp/agata-web-template-metrics.json",
      JSON.stringify({ browser: browser.version(), results: metrics }, null, 2),
    );
    console.log(
      "Eight modular templates passed mobile/desktop runtime rendering and overflow checks.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
