const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1000 },
  });
  page.setDefaultTimeout(40000);
  try {
    await page.goto(process.env.AGATA_TEST_URL);
    await page.waitForSelector("[data-web-studio]");
    const p = await page.evaluate(() =>
      window.pywebview.api.create_web_project("Security"),
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
    await page.evaluate(() => {
      window.editorCanary = "safe";
      document.querySelector("#ws-autosave").checked = false;
      const d = window.AgataWebSession;
      d.insert(
        "index.html",
        null,
        '<img alt="Hostile test" src="missing.png" onerror="parent.editorCanary=\'bad\'"><script>window.hostileRan=true;try{parent.editorCanary="bad"}catch(e){window.parentBlocked=true}window.previewReport={bridge:typeof window.pywebview};fetch(' +
          JSON.stringify(location.origin + "/fixture/api/list_projects") +
          ',{method:"POST",body:"[]"}).then(()=>window.fetchBlocked=false).catch(()=>window.fetchBlocked=true);</script>',
      );
    });
    await page.waitForTimeout(600);
    const canvas = page.frameLocator(".gjs-frame");
    assert.equal(
      await canvas.locator("body").evaluate(() => typeof window.hostileRan),
      "undefined",
    );
    assert.equal(await page.evaluate(() => window.editorCanary), "safe");
    await page.click("[data-mode=preview]");
    await page.waitForTimeout(1600);
    const frame = page.frames().find((f) => f.url().includes("/s/"));
    const report = await frame.evaluate(() => ({
      ran: window.hostileRan,
      parentBlocked: window.parentBlocked,
      fetchBlocked: window.fetchBlocked,
      bridge: window.previewReport?.bridge,
    }));
    assert.deepEqual(report, {
      ran: true,
      parentBlocked: true,
      fetchBlocked: true,
      bridge: "undefined",
    });
    assert.equal(await page.evaluate(() => window.editorCanary), "safe");
    assert.equal(
      await page.locator("#ws-preview").getAttribute("sandbox"),
      "allow-scripts allow-forms",
    );
    console.log(
      "Hostile project isolation passed: script-free canvas; preview scripts cannot reach parent, bridge or editor HTTP API.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
