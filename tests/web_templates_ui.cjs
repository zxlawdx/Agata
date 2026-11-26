const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
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
  const capture = await browser.newPage();
  const errors = [],
    metrics = [];
  const evidence=process.env.AGATA_EVIDENCE||"/tmp";fs.mkdirSync(evidence,{recursive:true});
  for (const contextPage of [page, capture]) {
    contextPage.on("pageerror", error => errors.push(error.stack || error.message));
    contextPage.on("requestfailed", request => {
      const failure = request.failure().errorText;
      if (failure !== "net::ERR_ABORTED") console.error(failure, request.url());
    });
  }
  async function waitForTemplate(runtime) {
    await runtime.locator("main").waitFor();
    await runtime.waitForFunction(() =>
      [...document.querySelectorAll("agata-include")].every(node => node.childElementCount > 0)
    );
  }
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
      const widthInput = page.locator("#ws-width");
      const viewportPreset = page.locator("#ws-viewport");
      if (template === "saas-dashboard") {
        await widthInput.fill("412");
        await widthInput.press("Tab");
        assert.equal(await viewportPreset.inputValue(), "custom");
        await page.waitForFunction(() => document.querySelector("#ws-preview").style.width === "412px");

        await widthInput.fill("");
        await widthInput.press("Tab");
        assert.equal(await widthInput.inputValue(), "412");

        await viewportPreset.selectOption("390");
        await viewportPreset.selectOption("custom");
        await page.locator("#ws-dialog").press("Escape");
        await page.waitForFunction(() => document.querySelector("#ws-viewport").value === "390");
        assert.equal(await viewportPreset.inputValue(), "390");
        assert.equal(await widthInput.inputValue(), "390");
      }

      await waitForTemplate(frame);
      await capture.goto(frame.url());
      await waitForTemplate(capture);
      if (template === "ecommerce") {
        const search = frame.locator("[data-search-form] input");
        await search.fill("Caneta");
        await search.press("Enter");
        const visibleProducts = frame.locator("article.card:visible");
        assert.deepEqual(await visibleProducts.locator("h3").allTextContents(), ["Caneta Traço"]);
        await visibleProducts.getByRole("button", { name: "Adicionar Caneta Traço ao carrinho" }).click();
        assert.equal(await frame.locator("[data-cart-count]").textContent(), "1");
        await search.fill("");
        await search.press("Enter");
        assert.equal(await visibleProducts.count(), 6);
      }
      for (const width of [320, 375, 1440]) {
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
        // Capture the runtime directly so the editor's iframe does not clip long pages.
        await capture.setViewportSize({ width, height: 900 });
        await capture.screenshot({
          path: path.join(evidence, "web-template-" + template + "-" + width + ".png"),
          fullPage: true,
          animations: "disabled",
        });
      }
      console.log("Template responsive:", template);
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(evidence,"web-template-metrics.json"),
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
