/* E2E regressions from the October 2026 user bug report. */
const assert = require("node:assert/strict");
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
 const browser = await chromium.launch({
  executablePath:process.env.CHROMIUM_PATH,
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]
 });
 const page = await browser.newPage({viewport:{width:1440,height:900}});
 page.setDefaultTimeout(40000);
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try {
  await page.goto(process.env.AGATA_TEST_URL);
  await page.locator("#agata-create").waitFor();
  await page.locator("#agata-create").click();
  await page.locator("#agata-platform").selectOption("web");
  assert.equal(await page.locator("#agata-wizard-settings").isVisible(),false);
  assert.equal(await page.locator("#agata-template option[value=empty]").count(),0);
  assert.equal(await page.locator("#agata-template option[value=saas-dashboard]").count(),1);
  await page.locator("#agata-name").fill("Wizard Web regression");
  await page.locator("#agata-template").selectOption("saas-dashboard");
  await page.locator("#agata-confirm-create").click();
  await page.waitForFunction(()=>window.AgataWebSession?.project.name==="Wizard Web regression");
  assert.equal(await page.locator("#web-studio").getAttribute("data-project-state"),"ready");
  assert(await page.locator("#ws-files").getByText("index.html").count());
  await page.locator("#ws-monaco .monaco-editor").waitFor();
  await page.locator("#ws-ide-theme").selectOption("dark");
  assert.equal(await page.locator("#web-studio").getAttribute("data-ide-theme"),"dark");
  await page.locator("#ws-ide-theme").selectOption("light");
  assert.equal(await page.locator("#web-studio").getAttribute("data-ide-theme"),"light");

  await page.evaluate(()=>window.Vela.navigate("/home"));
  await page.locator("#agata-create").waitFor();
  await page.locator("#agata-create").click();
  await page.locator("#agata-platform").selectOption("android");
  assert.equal(await page.locator("#agata-wizard-settings").isVisible(),true);
  assert(await page.locator("#agata-template option[value=empty]").count());
  assert.equal(await page.locator("#agata-template option[value=saas-dashboard]").count(),0);
  await page.locator("#agata-name").fill("Overlay regression");
  await page.locator("#agata-template").selectOption("empty");
  await page.locator("#agata-confirm-create").click();
  await page.locator("#ad-frames .ad-frame").waitFor();
  await page.getByRole("button",{name:"Agora não",exact:true}).click().catch(()=>{});
  await page.locator("#ad-example").click();
  assert.equal(await page.locator("#ad-links .ad-connection").count(),0);
  assert.equal(await page.locator("#ad-connections").getAttribute("aria-pressed"),"false");
  await page.locator("#ad-connections").click();
  assert(await page.locator("#ad-links .ad-connection").count()>0);
  assert.equal(await page.locator("#ad-connections").getAttribute("aria-pressed"),"true");
  await page.locator("#ad-connections").click();
  assert.equal(await page.locator("#ad-links .ad-connection").count(),0);
  await page.locator("#ad-constraint-mode").click();
  assert.equal(await page.locator("#ad-links .ad-connection").count(),0);
  assert.equal(await page.locator("#ad-constraint-mode").getAttribute("aria-pressed"),"true");
  await page.locator("#ad-flow").click();
  assert.match(await page.locator("#ad-flow-map").innerText(),/Dashboard/);
  await page.locator("#ad-flow-map").getByRole("button",{name:"Fechar"}).click();
  assert.deepEqual(errors,[]);
  console.log("P0 regressions passed: platform wizard, Web editor, IDE theme, hidden navigation, independent constraints and Flow Map.");
 } finally {
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
