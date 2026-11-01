const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"),
  assert = require("node:assert/strict");
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(process.env.AGATA_TEST_URL);
    await page.waitForSelector("[data-web-studio]");
    const p = await page.evaluate(() =>
      window.pywebview.api.create_web_project("Effects", "premium-landing"),
    );
    await page.evaluate(
      (id) => window.Vela.navigate("/web", { project_id: id }),
      p.id,
    );
    await page.waitForFunction(
      (id) => window.AgataWebSession?.project.id === id,
      p.id,
      { timeout: 40000 },
    );
    await page.waitForTimeout(800);
    await page.evaluate(
      () => (document.querySelector("#ws-autosave").checked = false),
    );
    const id = await page.evaluate(
      () =>
        [...window.AgataWebSession.nodes.values()].find((n) => n.tag === "h1")
          .id,
    );
    await page.locator('[data-node="' + id + '"]').click();
    await page
      .locator(".ws-right details")
      .filter({ has: page.locator("summary", { hasText: "Gradiente" }) })
      .locator("summary")
      .click();
    await page.fill("#ws-gradient-stops", "#112233 0%, #abcdef 100%");
    await page.click("[data-action=gradient]");
    await page.waitForTimeout(400);
    const canvas = page.frameLocator(".gjs-frame");
    assert(
      (
        await canvas
          .locator('[data-agata-id="' + id + '"]')
          .evaluate((el) => getComputedStyle(el).backgroundImage)
      ).includes("linear-gradient"),
    );
    await page
      .locator(".ws-right details")
      .filter({ has: page.locator("summary", { hasText: "Animação" }) })
      .last()
      .locator("summary")
      .click();
    const before = await page.evaluate(
      () => window.AgataWebSession.history.past.length,
    );
    await page.click("[data-action=animation]");
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(() => window.AgataWebSession.history.past.length),
      before + 1,
    );
    assert.equal(
      await canvas
        .locator('[data-agata-id="' + id + '"]')
        .evaluate((el) => getComputedStyle(el).animationName),
      "float",
    );
    await page.click("[data-action=undo]");
    await page.waitForTimeout(400);
    assert.equal(
      await canvas
        .locator('[data-agata-id="' + id + '"]')
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    await page.click("[data-action=redo]");
    await page.click("[data-action=save]");
    const exported = await page.evaluate(() =>
      window.AgataWebStudio.actions.export(),
    );
    const saved = await page.evaluate(() =>
      window.pywebview.api.export_web_project(
        window.AgataWebSession.project.id,
      ),
    );
    const result = await page.evaluate(async (path) => {
      const p = await window.pywebview.api.import_web_project(path);
      return window.pywebview.api.get_web_project(p.id);
    }, saved.path);
    assert(
      result.files["css/overrides.css"].content.includes("@keyframes float"),
    );
    assert(
      result.files["css/overrides.css"].content.includes("linear-gradient"),
    );
    assert.deepEqual(errors, []);
    console.log(
      "Gradient, keyframes, atomic undo and full ZIP reimport retained editable CSS.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
