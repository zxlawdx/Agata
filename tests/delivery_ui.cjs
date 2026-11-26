const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(process.env.AGATA_TEST_URL);
    await page.locator("#agata-create").waitFor();
    const project = await page.evaluate(async () => {
      const p = await pywebview.api.create_project({
        name: "Sabor de Feira", platform: "android", template: "list-detail",
      });
      await Vela.navigate("/android", { project_id: p.id });
      return p;
    });
    const frames = page.locator("#ad-frames .ad-frame");
    await frames.first().waitFor();
    assert.equal(await frames.count(), 2);
    const skip = page.getByRole("button", { name: "Agora não", exact: true });
    if (await skip.isVisible()) await skip.click();

    async function rename(frame, before, after) {
      await frame.getByText(before, { exact: true }).click();
      const field = page.locator('[data-property="text"]');
      await field.fill(after);
      await field.press("Tab");
      await frame.getByText(after, { exact: true }).waitFor();
    }

    await rename(frames.nth(0).locator(".ad-screen-content"), "Lista / Detalhes", "Sabor de Feira");
    await rename(frames.nth(0), "Abrir detalhes", "Ver tacacá");
    await rename(frames.nth(1).locator(".ad-screen-content"), "Detalhes", "Tacacá da feira");
    await rename(frames.nth(1), "Título do cartão", "Porção individual · R$ 18");
    await rename(frames.nth(1), "Descrição do cartão", "Tucupi, goma, jambu e camarão.");
    await page.locator("#ad-save").click();
    await page.getByText("Interface salva no computador.").waitFor();
    await page.evaluate(id => Vela.navigate("/android", { project_id: id }), project.id);
    await frames.first().getByText("Ver tacacá", { exact: true }).waitFor();

    await page.locator('[data-mode="preview"]').click();
    const preset = page.locator("#ad-preview-preset");
    const width = page.locator("#ad-preview-width");
    await preset.selectOption("320,640");
    await width.fill("360");
    await width.press("Tab");
    assert.equal(await preset.inputValue(), "custom");
    await width.fill("");
    await width.press("Tab");
    assert.equal(await width.inputValue(), "360");
    await page.locator('#ad-toast [aria-label="Fechar notificação"]').click();
    await preset.selectOption("390,844");
    await page.locator("#ad-preview-rotate").click();
    assert.equal(await preset.inputValue(), "844,390");
    await page.locator("#ad-preview-rotate").click();
    assert.equal(await preset.inputValue(), "390,844");

    const preview = page.locator("#ad-preview-screen");
    await preview.getByText("Ver tacacá", { exact: true }).click();
    await preview.getByText("Tacacá da feira", { exact: true }).waitFor();
    if (process.env.AGATA_EVIDENCE) {
      fs.mkdirSync(process.env.AGATA_EVIDENCE, { recursive: true });
      await preview.screenshot({ path: path.join(process.env.AGATA_EVIDENCE, "android-delivery-detail.png") });
    }
    await preview.getByText("Voltar", { exact: true }).click();
    await preview.getByText("Sabor de Feira", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log("Delivery prototype passed: catalog, detail navigation, persistence, and preview controls.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
