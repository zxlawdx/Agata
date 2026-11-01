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
    const p = await page.evaluate(async () => {
      const api = window.pywebview.api,
        p = await api.create_web_project("Imported blocks"),
        snapshot = await api.get_web_project(p.id);
      delete snapshot.project.web_document.template;
      await api.save_web_project(p.id, {
        files: {
          "index.html": {
            encoding: "utf8",
            content:
              '<!doctype html><HTML lang="pt-BR"><HEAD><meta charset="utf-8"><title>Original</title><style>h1{color:rgb(10,20,30)}</style><!-- keep comment --></HEAD><BODY><main><h1>Imported source</h1><article class="card">Needle</article></main></BODY></HTML>',
            expected_sha256: snapshot.files["index.html"].sha256,
          },
        },
        deleted: [],
        metadata: snapshot.project.web_document,
        revision: snapshot.revision,
      });
      return p;
    });
    await page.evaluate(
      (id) => window.Vela.navigate("/web", { project_id: id }),
      p.id,
    );
    await page.waitForFunction(
      (id) => window.AgataWebSession?.project.id === id,
      p.id,
      { timeout: 40000 },
    );
    await page.waitForSelector("#ws-blocks button");
    await page.fill("#ws-search-blocks", "Search Bar");
    await page.locator("#ws-blocks button").first().click();
    await page.waitForTimeout(500);
    const snapshot = await page.evaluate(() => ({
      files: [...window.AgataWebSession.files.keys()],
      source: window.AgataWebSession.text("index.html"),
    }));
    assert(snapshot.files.includes("agata-library-v1/interactions.js"));
    assert(snapshot.source.includes("keep comment"));
    assert(snapshot.source.includes("<HEAD>"));
    await page.click("[data-mode=preview]");
    await page.waitForTimeout(1400);
    const frame = page.frames().find((f) => f.url().includes("/s/"));
    await frame.locator("input[type=search]").fill("missing text");
    await frame.locator("form[data-search-form] button").click();
    assert(await frame.locator("article.card").evaluate((el) => el.hidden));
    assert.equal(
      await frame.locator("h1").evaluate((el) => getComputedStyle(el).color),
      "rgb(10, 20, 30)",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Imported document retained its source/style; inserted Search Bar brought scoped CSS and a functional local JS module.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
