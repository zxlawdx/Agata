const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("BROWSER", m.text().slice(0, 300));
  });
  try {
    await page.goto(process.env.AGATA_TEST_URL);
    await page.waitForSelector("[data-web-studio]");
    await page.click("[data-web-studio]");
    await page.waitForFunction(() => window.AgataWebStudio?.actions);
    await page.click("[data-action=create]");
    await page.fill("#ws-dialog-input", "Verified Web");
    await page.click("#ws-dialog button[value=ok]");
    await page.waitForFunction(
      () =>
        window.AgataWebSession?.project.name === "Verified Web" &&
        window.AgataWebSession.nodes.size > 10,
    );
    await page.waitForTimeout(1500);
    console.log("STATUS", await page.locator("#ws-status").textContent());
    console.log("ERRORS", errors);
    await page.evaluate(() => {
      document.querySelector("#ws-autosave").checked = false;
    });
    const result = await page.evaluate(() => {
      const d = window.AgataWebSession;
      const count = d.nodes.size;
      for (let i = 0; i < 5; i++)
        d.insert("index.html", null, "<div>Action " + i + "</div>");
      d.history.undo();
      return { count, after: d.nodes.size, source: d.text("index.html") };
    });
    assert.equal(result.after, result.count + 4);
    assert(!result.source.includes("Action 4"));
    assert(result.source.includes("Action 3"));
    await page.evaluate(() => window.AgataWebStudio.actions.save());
    await page.click("[data-mode=preview]");
    await page.waitForFunction(() =>
      document.querySelector("#ws-preview").src.includes("/s/"),
    );
    await page.waitForTimeout(1500);
    const frame = page.frames().find((f) => f.url().includes("/s/"));
    assert(frame);
    await frame.waitForSelector("main");
    const isolated = await frame.evaluate(() => {
      let denied = false;
      try {
        void parent.document.body;
      } catch {
        denied = true;
      }
      return {
        denied,
        bridge: typeof window.pywebview,
        main: !!document.querySelector("main"),
        included: !!document.querySelector("agata-include nav"),
      };
    });
    console.log("ISOLATION", isolated);
    assert(isolated.denied);
    assert.equal(isolated.bridge, "undefined");
    assert(isolated.included);
    await page.click("[data-mode=split]");
    await page.screenshot({
      path: "/tmp/agata-web-studio.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log("Web Studio browser round-trip and isolated runtime passed.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
