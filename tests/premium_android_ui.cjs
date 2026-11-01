const fs=require("node:fs"),path=require("node:path");
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
  fs.mkdirSync(process.env.AGATA_EVIDENCE||"/tmp",{recursive:true});
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(process.env.AGATA_TEST_URL);
    await page.waitForSelector("[data-web-studio]");
    for (const key of [
      "music-dark",
      "social-modern",
      "editorial-minimal",
      "fintech-premium",
      "material-expressive",
      "glass-blur",
    ]) {
      const p = await page.evaluate(
        (key) =>
          window.pywebview.api.create_project({
            name: key,
            platform: "android",
            template: key,
          }),
        key,
      );
      await page.evaluate(
        (id) => window.Vela.navigate("/android", { project_id: id }),
        p.id,
      );
      await page.waitForSelector("#ad-frames .ad-frame");
      assert.equal(await page.locator("#ad-frames .ad-frame").count(), ["music-dark","social-modern","fintech-premium"].includes(key) ? 6 : 2);
      await page.click("[data-mode=preview]");
      await page.waitForTimeout(150);
      await page.selectOption("#ad-preview-preset", "1600,1000");
      await page.waitForTimeout(150);
      if (["music-dark","social-modern","fintech-premium"].includes(key)) {
        await page.screenshot({
          path: path.join(process.env.AGATA_EVIDENCE||"/tmp","android-premium-"+key+".png"),
          fullPage:true
        });
      }
      console.log("Premium UI:", key);
    }
    assert.deepEqual(errors, []);
    console.log(
      "Six original Android template browser previews passed (not native Android rendering).",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
