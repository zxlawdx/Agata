/* Real Monaco -> source document -> GrapesJS canvas -> isolated runtime -> save/reopen. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 page.setDefaultTimeout(40000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const evidence=process.env.AGATA_EVIDENCE||"/tmp/agata-evidence";
 fs.mkdirSync(evidence,{recursive:true});
 try{
  await page.goto(process.env.AGATA_TEST_URL);
  await page.locator("[data-web-studio]").waitFor();
  const project=await page.evaluate(()=>window.pywebview.api.create_web_project("Monaco Sync E2E","premium-landing"));
  await page.evaluate(id=>window.Vela.navigate("/web",{project_id:id}),project.id);
  await page.waitForFunction(id=>window.AgataWebSession?.project.id===id,project.id);
  await page.locator("#ws-monaco .monaco-editor").waitFor();
  await page.frameLocator(".gjs-frame").locator("main").waitFor({state:"attached"});
  assert(await page.locator("#ws-blocks button").count()>80);
  assert(await page.locator("#ws-properties [data-css]").count()>0);
  await page.locator("#ws-autosave").uncheck();
  await page.locator('#ws-files button[data-file="index.html"]').click();
  await page.evaluate(()=>{
   const monaco=window.AgataMonacoVendor;
   const model=monaco.editor.getModels().find(m=>m.uri.path.endsWith("/index.html"));
   if(!model)throw Error("Modelo Monaco HTML indisponível");
   const before=model.getValue();
   if(!before.includes("Ideias claras."))throw Error("HTML de template inesperado");
   model.setValue(before.replace("Ideias claras.","Código e Design."));
  });
  await page.waitForFunction(()=>window.AgataWebSession?.text("index.html").includes("Código e Design."));
  await page.waitForFunction(()=>document.querySelector(".gjs-frame")?.contentDocument?.querySelector("h1")?.textContent?.includes("Código e Design."));
  await page.locator('#ws-files button[data-file="css/tokens.css"]').click();
  await page.evaluate(()=>{
   const model=window.AgataMonacoVendor.editor.getModels().find(m=>m.uri.path.endsWith("/css/tokens.css"));
   if(!model)throw Error("Modelo Monaco CSS indisponível");
   const previous=model.getValue();
   const changed=previous.replace(/--colors-primary:\s*#[\da-f]{6}/i,"--colors-primary: #ab2167");
   if(changed===previous)throw Error("Token CSS ausente");
   model.setValue(changed);
  });
  await page.waitForFunction(()=>window.AgataWebSession?.text("css/tokens.css").includes("#ab2167"));
  await page.waitForFunction(()=>{
   const doc=document.querySelector(".gjs-frame")?.contentDocument;
   return doc?.defaultView?.getComputedStyle(doc.documentElement).getPropertyValue("--colors-primary").trim()==="#ab2167";
  });
  await page.locator('#ws-files button[data-file="js/main.js"]').click();
  await page.evaluate(()=>{
   const model=window.AgataMonacoVendor.editor.getModels().find(m=>m.uri.path.endsWith("/js/main.js"));
   if(!model)throw Error("Modelo Monaco JS indisponível");
   model.setValue(model.getValue()+"\nwindow.__agataMonacoSync = 'executado';\nconsole.log('AGATA_MONACO_SYNC_E2E');\n");
  });
  await page.waitForFunction(()=>window.AgataWebSession?.text("js/main.js").includes("AGATA_MONACO_SYNC_E2E"));
  await page.locator('[data-action="save"]').click();
  await page.locator('[data-mode="preview"]').click();
  await page.waitForFunction(()=>document.querySelector("#ws-preview")?.src?.includes("/s/"));
  await page.frameLocator("#ws-preview").locator("main").waitFor({state:"attached"});
  await page.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>{
   try{return f.contentWindow?.__agataMonacoSync==="executado";}catch{return false;}
  }),null,{timeout:2000}).catch(()=>{});
  const runtime=page.frames().find(frame=>frame.url().includes("/s/"));
  assert(runtime,"Preview runtime não carregou");
  await runtime.waitForFunction(()=>window.__agataMonacoSync==="executado");
  assert((await page.locator("#ws-console").textContent()).includes("AGATA_MONACO_SYNC_E2E"));
  await page.screenshot({path:path.join(evidence,"web-code-sync-preview.png"),fullPage:true});
  await page.locator('[data-mode="split"]').click();
  await page.screenshot({path:path.join(evidence,"web-code-sync-editor.png"),fullPage:true});
  await page.evaluate(id=>window.Vela.navigate("/web",{project_id:id}),project.id);
  await page.waitForFunction(id=>window.AgataWebSession?.project.id===id,project.id);
  const saved=await page.evaluate(()=>({
   html:window.AgataWebSession.text("index.html"),
   css:window.AgataWebSession.text("css/tokens.css"),
   js:window.AgataWebSession.text("js/main.js"),
  }));
  assert(saved.html.includes("Código e Design."));
  assert(saved.css.includes("#ab2167"));
  assert(saved.js.includes("AGATA_MONACO_SYNC_E2E"));
  assert.deepEqual(errors,[]);
  console.log("Web code sync passed: Monaco HTML/CSS/JS, canvas, isolated preview, persistence, E2E screenshots.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
