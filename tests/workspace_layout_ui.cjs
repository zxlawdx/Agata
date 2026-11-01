/* Interactive browser regression for Agata's resizable Web workspace and canvas zoom.
 * Runs real GrapesJS/Monaco through a Vela HTTP fixture; no mocked DOM snapshots.
 */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(40000);
const errors=[];page.on("pageerror",err=>errors.push(err.message));
const evidence=process.env.AGATA_EVIDENCE||"/tmp/agata-evidence";fs.mkdirSync(evidence,{recursive:true});
const screenshot=async(name)=>page.screenshot({path:path.join(evidence,name),fullPage:true});
const drag=async(selector,delta)=>{
 const box=await page.locator(selector).boundingBox();
 assert(box,selector+" not visible");const x=box.x+box.width/2,y=box.y+Math.min(100,box.height/2);
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+delta,y,{steps:10});await page.mouse.up();
};
try{
 await page.goto(process.env.AGATA_TEST_URL);
 await page.locator("[data-web-studio]").waitFor();
 const project=await page.evaluate(()=>window.pywebview.api.create_web_project("Resizable Workspace","premium-landing"));
 await page.evaluate(id=>window.Vela.navigate("/web",{project_id:id}),project.id);
 await page.waitForFunction(id=>window.AgataWebSession?.project?.id===id,project.id);
 await page.locator("#ws-canvas .gjs-editor").waitFor({state:"attached"});
 await page.locator('button[data-mode="split"]').click();
 await page.frameLocator(".gjs-frame").locator("main").waitFor({state:"attached"});
 await page.locator("#ws-monaco .monaco-editor").waitFor({state:"visible"});
 const baseline=await page.locator("#ws-design").boundingBox();
 const viewport=await page.locator("#ws-width").inputValue();
 assert.equal(viewport,"1440");
 await screenshot("web-split-before-resize.png");
 await drag("#ws-center-splitter",110);
 const larger=await page.locator("#ws-design").boundingBox();
 assert(larger.width>baseline.width+55,JSON.stringify({baseline:baseline.width,larger:larger.width}));
 assert.equal(await page.locator("#ws-width").inputValue(),viewport,"Drag cannot alter logical viewport");
 await screenshot("web-split-resized.png");
 const explorer=await page.locator(".ws-left").boundingBox();
 await drag("#ws-left-splitter",55);
 const explorerAfter=await page.locator(".ws-left").boundingBox();
 assert(explorerAfter.width>explorer.width+35);
 await page.locator("#ws-zoom-mode").selectOption("fit-width");
 const fitted=Number(await page.locator("#ws-zoom-value").inputValue());
 assert(fitted>20&&fitted<100);
 await screenshot("web-canvas-fit-width.png");
 await page.locator('[data-action="canvaszoom"]').click();
 assert.equal(Number(await page.locator("#ws-zoom-value").inputValue()),100);
 assert.equal(await page.locator("#ws-width").inputValue(),viewport);
 await screenshot("web-canvas-zoom-100.png");
 await page.locator("#ws-zoom-minus").click();
 assert.equal(Number(await page.locator("#ws-zoom-value").inputValue()),85);
 await page.locator("#ws-zoom-mode").selectOption("fit-screen");
 assert.equal(await page.locator("#ws-zoom-mode").inputValue(),"fit-screen");
 await page.locator("#ws-focus-mode").click();
 assert.equal(await page.locator("#web-studio").getAttribute("data-focus"),"true");
 assert.equal(await page.locator(".ws-right").isVisible(),false);
 assert.equal(await page.locator(".ws-left").isVisible(),false);
 await screenshot("web-focus-mode.png");
 await page.locator("#ws-focus-mode").click();
 await page.locator('button[data-action="right"]').click();
 assert.equal(await page.locator(".ws-right").isVisible(),false);
 await screenshot("web-inspector-collapsed.png");
 await page.locator('button[data-action="right"]').click();
 assert.equal(await page.locator(".ws-right").isVisible(),true);
 await page.evaluate(id=>window.Vela.navigate("/web",{project_id:id}),project.id);
 await page.waitForFunction(id=>window.AgataWebSession?.project?.id===id,project.id);
 assert.equal(await page.locator("#ws-zoom-mode").inputValue(),"fit-screen");
 const reopened=await page.locator("#ws-design").boundingBox();
 assert(reopened.width>baseline.width+30,"Split ratio not persisted across reopen");
 await page.locator("#ws-layout-reset").click();
 assert.equal(await page.locator("#ws-zoom-mode").inputValue(),"fit-width");
 await page.setViewportSize({width:1366,height:768});
 await screenshot("web-split-1366.png");
 await page.setViewportSize({width:1920,height:1080});
 await screenshot("web-split-1920.png");
 assert.deepEqual(errors,[]);
 console.log("Interactive Workspace UI: real divider drags, independent canvas zoom, focus/Inspector, persistence, reset and 1366/1920 screenshots passed.");
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
