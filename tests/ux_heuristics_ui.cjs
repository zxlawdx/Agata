/* Nielsen-oriented browser acceptance: visibility, recovery, focus, modes and viewports. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.setDefaultTimeout(40000);
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const evidence=process.env.AGATA_EVIDENCE||"/tmp";fs.mkdirSync(evidence,{recursive:true});
 try{
  await page.goto(process.env.AGATA_TEST_URL);
  await page.locator('[data-web-studio]').click();
  await page.waitForFunction(()=>document.querySelector("#web-studio")?.dataset.projectState==="empty");
  assert(await page.locator("#ws-welcome").isVisible());
  assert(!(await page.locator(".ws-layout").isVisible()));
  assert(await page.locator("#ws-welcome").getByRole("button",{name:/Usar modelo/}).isEnabled());
  for(const dims of [[1366,768],[1440,900],[1920,1080]]){
   await page.setViewportSize({width:dims[0],height:dims[1]});
   const root=await page.locator("#web-studio").evaluate(el=>{
    const rect=el.getBoundingClientRect();return {width:rect.width,scroll:el.scrollWidth};
   });
   assert(root.scroll<=root.width+4,"Web onboarding overflow "+dims+JSON.stringify(root));
   if(dims[0]===1440)await page.screenshot({path:path.join(evidence,"web-studio-no-project.png"),fullPage:true});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator("#ws-project-template").selectOption("saas-dashboard");
  await page.locator("#ws-welcome").getByRole("button",{name:/Usar modelo/}).click();
  await page.locator("#ws-dialog-input").fill("UX verified");
  await page.locator("#ws-dialog button[value=ok]").click();
  await page.waitForFunction(()=>window.AgataWebSession?.project.name==="UX verified");
  assert(await page.locator(".ws-layout").isVisible());
  assert(await page.locator("#ws-files button").count()>10);
  assert(await page.locator("#ws-block-category option").count()>5);
  assert(await page.locator("#ws-blocks button").count()>30);
  assert(await page.locator("#ws-properties [data-css]").count()>0);
  await page.locator("#ws-monaco .monaco-editor").waitFor();
  await page.frameLocator(".gjs-frame").locator("main").waitFor({state:"attached"});
  await page.locator("#ws-block-category").selectOption({label:"HTML · Forms"});
  assert(await page.locator("#ws-blocks button").count()>0);
  await page.locator("#ws-block-category").selectOption("all");
  await page.locator("#ws-ide-theme").selectOption("light");
  assert(await page.locator("#ws-monaco .monaco-editor").evaluate(el=>el.classList.contains("vs")));
  await page.locator("#ws-ide-theme").selectOption("dark");
  assert(await page.locator("#ws-monaco .monaco-editor").evaluate(el=>el.classList.contains("vs-dark")));
  for(const mode of ["design","code","split","preview"]){
   await page.locator('[data-mode="'+mode+'"]').click();
   assert.equal(await page.locator('[data-mode="'+mode+'"]').getAttribute("aria-pressed"),"true");
   assert.equal(await page.locator('[data-mode][aria-pressed="true"]').count(),1);
  }
  await page.locator('[data-mode="split"]').click();
  await page.locator('#ws-files button[data-file="index.html"]').click();
  await page.screenshot({path:path.join(evidence,"web-studio-ihc-dark.png"),fullPage:true});
  await page.locator("#ws-ide-theme").selectOption("light");
  await page.screenshot({path:path.join(evidence,"web-studio-ihc-light.png"),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log("UX heuristics E2E passed: empty/ready status, editable panels, palette filters, theme, exclusive modes and responsive views.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
