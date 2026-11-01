/* Browser reproducer of Windows-reported canvas gestures.
   Real Chromium/GrapesJS frame input. Windows pywebview still needs native QA. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.setDefaultTimeout(35000);
 const images=process.env.AGATA_EVIDENCE||"/tmp/agata-evidence";fs.mkdirSync(images,{recursive:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const shot=name=>page.screenshot({path:path.join(images,name+".png"),fullPage:true});
 const drag=async(x,y,button,dx,dy)=>{
  await page.mouse.move(x,y);await page.mouse.down({button});
  await page.mouse.move(x+dx/2,y+dy/2,{steps:4});
  await page.mouse.move(x+dx,y+dy,{steps:4});await page.mouse.up({button});
 };
 try{
  await page.goto(process.env.AGATA_TEST_URL);
  await page.locator("[data-web-studio]").waitFor();
  const p=await page.evaluate(()=>window.pywebview.api.create_web_project("Agata pan free layers","premium-landing"));
  await page.evaluate(id=>window.Vela.navigate("/web",{project_id:id}),p.id);
  await page.waitForFunction(id=>window.AgataWebSession?.project?.id===id,p.id);
  await page.frameLocator(".gjs-frame").locator("h1").waitFor();
  await page.locator('button[data-mode="design"]').click();
  await page.locator(".ws-canvas-popover summary").click();
  await page.locator("#ws-grid-visible").waitFor();
  const original=await page.evaluate(()=>({
   html:window.AgataWebSession.text("index.html"),
   css:window.AgataWebSession.text("css/overrides.css"),
  }));
  assert(await page.locator("#ws-design .gjs-cv-canvas").count()>0);
  assert.equal(await page.locator("#web-studio").getAttribute("data-canvas-grid"),"true");
  await shot("agata-canvas-turquoise-before");
  await page.locator("#ws-grid-visible").uncheck();
  assert.equal(await page.locator("#web-studio").getAttribute("data-canvas-grid"),"false");
  await shot("agata-canvas-without-grid");
  await page.locator("#ws-grid-visible").check();
  const design=await page.locator("#ws-design").boundingBox();
  const center={x:design.x+design.width*.52,y:design.y+design.height*.48};
  const frame=()=>page.locator(".gjs-frame").boundingBox();
  const points=[];
  const initial=await frame();
  for(let i=0;i<5;i++){
   await drag(center.x,center.y,"middle",24,14);
   const b=await frame();points.push([b.x,b.y]);
   await shot("agata-pan-middle-"+String(i+1).padStart(2,"0"));
  }
  const after=await frame();
  assert(Math.abs(after.x-initial.x)>35||Math.abs(after.y-initial.y)>35,
    "Middle pan must move the workspace frame");
  await page.locator("#ws-design").focus();
  await page.keyboard.down("Space");
  const preSpace=await frame();
  await drag(center.x,center.y,"left",-38,26);
  await page.keyboard.up("Space");
  const postSpace=await frame();
  assert(Math.abs(postSpace.x-preSpace.x)>15||Math.abs(postSpace.y-preSpace.y)>15,
    "Space+left drag must pan");
  await shot("agata-pan-space");
  for(const zoom of [35,100,150]){
   await page.locator("#ws-zoom-mode").selectOption("custom");
   await page.locator("#ws-zoom-value").fill(String(zoom));
   await page.locator("#ws-zoom-value").dispatchEvent("change");
   assert.equal(Number(await page.locator("#ws-zoom-value").inputValue()),zoom);
   await shot("agata-zoom-"+zoom);
  }
  await page.locator("#ws-zoom-value").fill("100");
  await page.locator("#ws-zoom-value").dispatchEvent("change");
  await page.locator("#ws-grid-spacing").fill("12");
  await page.locator("#ws-grid-spacing").dispatchEvent("change");
  await page.locator("#ws-grid-snap").check();
  const h1=await page.evaluate(()=>[...window.AgataWebSession.nodes.values()].find(n=>n.file==="index.html"&&n.tag==="h1")?.id);
  assert(h1);
  await page.locator('#ws-tree [data-node="'+h1+'"]').click();
  assert((await page.locator("#ws-selection").textContent()).includes("<h1>"));
  assert.equal(await page.locator('#ws-tree [data-layer-id="'+h1+'"]').getAttribute("aria-selected"),"true");
  await shot("agata-layers-selected");
  await page.locator('[data-action="preparecontainer"]').click();
  await page.waitForFunction(id=>{
   const n=window.AgataWebSession?.nodes.get(id);
   return n?.parent&&window.AgataWebSession.text("css/overrides.css").includes(n.parent.id);
  },h1);
  await page.locator("#ws-position-mode").selectOption("free");
  const element=page.frameLocator(".gjs-frame").locator('[data-agata-id="'+h1+'"]');
  const e=await element.boundingBox();assert(e,"target element not in iframe");
  await drag(e.x+Math.min(30,e.width/2),e.y+Math.min(12,e.height/2),"left",46,24);
  await page.waitForFunction(id=>{
   const css=window.AgataWebSession?.text("css/overrides.css")||"";
   return css.includes(id)&&css.includes("position: absolute")&&css.includes("left:");
  },h1);
  await shot("agata-free-drag-after");
  const moved=await page.evaluate(()=>window.AgataWebSession.text("css/overrides.css"));
  assert(moved!==original.css&&moved.includes("position: absolute"));
  await page.locator('[data-action="save"]').click();
  await page.waitForFunction(()=>document.querySelector("#ws-status")?.textContent.includes("Salvo"));
  await page.evaluate(id=>window.Vela.navigate("/web",{project_id:id}),p.id);
  await page.waitForFunction(id=>window.AgataWebSession?.project?.id===id&&
    document.querySelector("#web-studio")?.dataset.projectState==="ready",p.id);
  assert((await page.evaluate(()=>window.AgataWebSession.text("css/overrides.css"))).includes("position: absolute"));
  assert.equal(await page.evaluate(()=>window.AgataWebSession.text("index.html")),original.html,
    "Pan, grid and zoom must not mutate authored HTML");
  await shot("agata-free-drag-reopened");
  assert.deepEqual(errors,[]);
  console.log("Agata canvas tested: five middle pan movements, space pan, 35/100/150 zoom, dot grid, synced Layers, free CSS drag, persistence and immutable HTML.");
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1});
