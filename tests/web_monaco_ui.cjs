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
  try {
    await page.goto(process.env.AGATA_TEST_URL);
    await page.waitForSelector("[data-web-studio]");
    const p = await page.evaluate(() =>
      window.pywebview.api.create_web_project("Language services"),
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
    await page.waitForSelector('#ws-files button[data-file="index.html"]');
    await page.evaluate(
      () => (document.querySelector("#ws-autosave").checked = false),
    );
    await page.click('#ws-files button[data-file="js/main.js"]');
    await page.evaluate(() =>
      window.AgataMonacoVendor.editor
        .getModels()
        .find((m) => m.uri.path.endsWith("/js/main.js"))
        .setValue("const broken = ;"),
    );
    await page.waitForFunction(
      () =>
        window.AgataMonacoVendor.editor
          .getModelMarkers({})
          .some(
            (m) => m.resource.path.endsWith("/js/main.js") && m.severity === 8,
          ),
      null,
      { timeout: 15000 },
    );
    await page.click("[data-action=undo]");
    assert(
      (
        await page.evaluate(() => window.AgataWebSession.text("js/main.js"))
      ).includes("mountIncludes"),
    );
    await page.click('#ws-files button[data-file="index.html"]');
    await page.evaluate(() => window.AgataWebStudio.actions.format());
    await page.waitForFunction(
      () =>
        window.AgataMonacoVendor.editor
          .getModels()
          .find((m) => m.uri.path.endsWith("/index.html"))
          .getLineCount() > 5,
      null,
      { timeout: 15000 },
    );
    assert(
      (await page.locator("#ws-tabs").textContent()).includes("js/main.js"),
    );
    console.log(
      "Local Monaco workers passed JS syntax diagnostics, source history, HTML formatting and distinct file models.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
