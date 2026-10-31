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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.addInitScript(() => {
      window.pywebview = {
        api: new Proxy(
          {},
          {
            get:
              (_, name) =>
              (...args) =>
                window.pywebview._jsApiCallback(name, args, "test"),
          },
        ),
        _jsApiCallback: async (name, params, id) => {
          const response = await fetch("/fixture/native-dispatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, params, id }),
          });
          const data = await response.json();
          return data.result;
        },
      };
    });
    const base = new URL(process.env.AGATA_TEST_URL).origin;
    await page.goto(base + "/__vela__/shell?entry=/home");
    await page.waitForSelector("[data-web-studio]");
    assert(await page.evaluate(() => window.pywebview._agataTransportGuard));
    assert(
      Array.isArray(
        await page.evaluate(() => window.pywebview.api.list_projects()),
      ),
    );
    const raw = await page.evaluate(async () => {
      const r = await fetch("/fixture/native-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "list_projects",
          params: [],
          id: "raw-frame",
        }),
      });
      return r.json();
    });
    assert.equal(raw.result, false);
    await page.click("[data-web-studio]");
    await page.waitForSelector("#ws-status");
    await page.waitForFunction(
      () => document.querySelector("#web-studio")?.inert === false,
      null,
      { timeout: 40000 },
    );
    await page.click("[data-action=create]");
    await page.fill("#ws-dialog-input", "Native shell project");
    await page.click("#ws-dialog button[value=ok]");
    await page.waitForFunction(
      () => window.AgataWebSession?.project.name === "Native shell project",
      null,
      { timeout: 40000 },
    );
    assert.deepEqual(errors, []);
    console.log(
      "Real Vela shell bootstrapped the protected transport, rejected raw subframe calls and created/opened a Web project.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
