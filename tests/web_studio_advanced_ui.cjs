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
      window.pywebview.api.create_web_project("Advanced", "premium-landing"),
    );
    await page.evaluate(
      (id) => window.Vela.navigate("/web", { project_id: id }),
      p.id,
    );
    await page.waitForFunction(
      (id) =>
        window.AgataWebSession?.project.id === id &&
        window.AgataWebStudio?.actions,
      p.id,
      { timeout: 40000 },
    );
    await page.waitForTimeout(1200);
    await page.evaluate(
      () => (document.querySelector("#ws-autosave").checked = false),
    );
    const iframe = page.frameLocator(".gjs-frame");
    const colors = await iframe.locator("body").evaluate((el) => {
      const s = el.ownerDocument.defaultView.getComputedStyle(el);
      return {
        primary: s.getPropertyValue("--colors-primary"),
        bg: el.ownerDocument.defaultView.getComputedStyle(
          el.ownerDocument.documentElement,
        ).backgroundColor,
      };
    });
    console.log("CANVAS CSS", colors);
    assert(colors.primary.trim().startsWith("#"));
    const original = await page.evaluate(() =>
      window.AgataWebSession.text("css/components.css"),
    );
    const node = await page.evaluate(() => {
      const d = window.AgataWebSession;
      return [...d.nodes.values()].find((n) => n.tag === "h1").id;
    });
    await page.locator('#ws-tree [data-node="' + node + '"]').click();
    await page
      .locator("#ws-properties details")
      .filter({ has: page.locator("summary", { hasText: "Typography" }) })
      .locator("summary")
      .click();
    await page.locator('[data-css="color"]').fill("#123456");
    await page.locator('[data-css="color"]').press("Tab");
    await page.waitForTimeout(600);
    assert.equal(
      await iframe
        .locator('[data-agata-id="' + node + '"]')
        .evaluate((el) => getComputedStyle(el).color),
      "rgb(18, 52, 86)",
    );
    assert.equal(
      await page.evaluate(() =>
        window.AgataWebSession.text("css/components.css"),
      ),
      original,
    );
    await page.click("[data-action=undo]");
    await page.waitForTimeout(400);
    assert.notEqual(
      await iframe
        .locator('[data-agata-id="' + node + '"]')
        .evaluate((el) => getComputedStyle(el).color),
      "rgb(18, 52, 86)",
    );
    await page.fill("#ws-search-blocks", "<div>");
    const count = await page.evaluate(() => window.AgataWebSession.nodes.size);
    await page
      .locator("#ws-blocks button")
      .first()
      .dragTo(iframe.locator("main"), { targetPosition: { x: 220, y: 150 } });
    await page.waitForTimeout(500);
    assert.equal(
      await page.evaluate(() => window.AgataWebSession.nodes.size),
      count + 1,
    );
    await page.evaluate(() => {
      const d = window.AgataWebSession;
      d.edit(
        "index.html",
        d
          .text("index.html")
          .replace("</head>", "<!-- unknown head comment --></head>"),
        "Code comment",
      );
      d.edit(
        "js/main.js",
        d.text("js/main.js") +
          '\nconsole.log("USER MODULE WORKED");\nwindow.previewIsolation = { bridge: typeof window.pywebview };\n',
      );
    });
    await page.click("[data-action=save]");
    await page.click("[data-mode=preview]");
    await page.waitForTimeout(1800);
    const runtime = page.frames().find((f) => f.url().includes("/s/"));
    assert(runtime);
    assert.equal(
      await runtime.evaluate(() => window.previewIsolation.bridge),
      "undefined",
    );
    assert(
      (await page.locator("#ws-console").textContent()).includes(
        "USER MODULE WORKED",
      ),
    );
    await page.selectOption("#ws-viewport", "375");
    await page.waitForTimeout(250);
    const overflow = await runtime.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
    }));
    assert(overflow.scroll <= overflow.width + 2, JSON.stringify(overflow));
    await page.screenshot({
      path: "/tmp/agata-web-preview-mobile.png",
      fullPage: true,
    });
    await page.click("[data-action=home]");
    await page.waitForSelector("[data-web-studio]");
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
    assert(
      (
        await page.evaluate(() => window.AgataWebSession.text("index.html"))
      ).includes("unknown head comment"),
    );
    assert.deepEqual(errors, []);
    console.log(
      "Advanced Web Studio UI: CSS cascade, undo, palette drag, code/JS preview, responsive overflow and reopen passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
