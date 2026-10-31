/* Run against tests/ui_server.py. Exercises rendered Vela templates and real
   isolated Python project services, with an HTTP substitute for pywebview. */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('requestfailed',r=>console.error('REQUEST:',r.url(),r.failure()));page.on('response',r=>{if(r.status()>=400)console.error('HTTP:',r.status(),r.url())});
 page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE:',e.message)});page.setDefaultTimeout(10000);
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto(process.env.AGATA_TEST_URL || 'http://127.0.0.1:40247/fixture');
 await page.getByText('Seu primeiro projeto começa aqui.').waitFor();
 const selected=async()=>page.locator('.agata-nav .active').evaluateAll(nodes=>nodes.map(n=>n.dataset.editorMode||n.dataset.section));
 for(const mode of ['svg','drawing','sketch']){
  await page.locator(`[data-editor-mode="${mode}"]`).click();assert.deepEqual(await selected(),[mode]);
  await page.locator('#agata-cancel-create').click();assert.deepEqual(await selected(),['home']);
 }
 for(const section of ['templates','projects','home']){
  await page.locator(`[data-section="${section}"]`).click();assert.deepEqual(await selected(),[section]);
 }
 await page.locator('[data-section="templates"]').click();await page.locator('[data-preset="svg"]').click();await page.keyboard.press('Escape');
 assert.deepEqual(await selected(),['templates']);
 // Failure and retry must replace loading, never leave an empty pink region.
 await page.route('**/fixture/api/list_projects',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'fixture failure'})}));
 await page.evaluate(()=>window.Vela.navigate('/home'));await page.getByText(/Não foi possível carregar projetos/).waitFor();
 await page.unroute('**/fixture/api/list_projects');await page.getByRole('button',{name:'Tentar novamente'}).click();await page.getByText('Seu primeiro projeto começa aqui.').waitFor();
 // Hold a bridge response to verify a visible loading state.
 let release;const gate=new Promise(r=>release=r);
 await page.route('**/fixture/api/list_projects',async r=>{await gate;await r.continue();});
 await page.evaluate(()=>window.Vela.navigate('/home'));await page.getByText('Carregando projetos…').waitFor();release();await page.unroute('**/fixture/api/list_projects');
 await page.getByText('Seu primeiro projeto começa aqui.').waitFor();
 for(const [width,height] of [[1920,1080],[1440,900],[1024,768],[640,480],[390,700]]){
  await page.setViewportSize({width,height});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`home overflow at ${width}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),`home height at ${height}`);
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('[data-editor-mode="svg"]').click();await page.locator('#agata-name').fill('Teste SVG offline');await page.locator('#agata-confirm-create').click();
 await page.locator('#ys-save:not([disabled])').waitFor();assert.equal(await page.evaluate(()=>fabric.version),'5.3.0');
 await page.locator('[data-component="button"]').click();
 await page.locator('#ys-edit-component').click();await page.locator('#ys-finish-component').waitFor();
 await page.locator('#ys-add-icon').click();await page.locator('#ys-finish-component').click();
 await page.locator('#ys-add-layer').click();assert.equal(await page.locator('.ys-layer-item').count(),4);
 await page.locator('.ys-layer-item.active [aria-label="Bloquear camada"]').click();
 await page.locator('.ys-layer-item.active [aria-label="Desbloquear camada"]').click();
 const drag=async(tool)=>{
  await page.locator('.ys-toolbar [data-tool="'+tool+'"]').click();
  const box=await page.locator('.upper-canvas').boundingBox();
  await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+90,box.y+80,{steps:5});await page.mouse.up();
 };
 for(const tool of ['rect','ellipse','triangle','diamond','line','pen'])await drag(tool);
 await page.locator('#ys-undo').click();await page.locator('#ys-redo:not([disabled])').waitFor();await page.locator('#ys-redo').click();
 await page.locator('#ys-zoom-in').click();await page.locator('#ys-zoom-out').click();await page.locator('#ys-fit').click();
 await page.locator('#ys-toggle-grid').click();assert.equal(await page.locator('#ys-toggle-grid').getAttribute('aria-pressed'),'false');
 await page.locator('#ys-save').click();await page.getByText('Projeto salvo no computador.').waitFor();
 for(const format of ['svg','png','json']){
  await page.locator('#ys-export-'+format).click();await page.locator('#ys-message').filter({hasText:'.'+format}).waitFor();
 }
 const document=await page.evaluate(async()=>{const p=(await pywebview.api.list_projects())[0];return pywebview.api.get_project(p.id)});
 assert.equal(document.screens[0].layers.length,4);assert.ok(document.screens[0].layers[3].objects.length>=6);
 await page.locator('#ys-home').click();await page.getByRole('button',{name:'Abrir projeto Teste SVG offline'}).waitFor();
 await page.getByRole('button',{name:'Abrir projeto Teste SVG offline'}).click();await page.locator('#ys-save:not([disabled])').waitFor();
 assert.ok(await page.locator('#ys-object-tree').textContent());
 for(const [width,height] of [[1440,900],[1024,768],[640,480]]){
  await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`editor overflow ${width}`);
 }
 await page.setViewportSize({width:390,height:700});
 await page.locator('#ys-toggle-tools').click();assert.equal(await page.locator('#ys-tools-panel').isVisible(),true);
 await page.locator('#ys-toggle-inspector').click();assert.equal(await page.locator('#ys-tools-panel').isVisible(),false);
 assert.equal(await page.locator('#ys-inspector-panel').isVisible(),true);
 await page.locator('#ys-toggle-inspector').click();
 if(process.env.AGATA_EVIDENCE){
  const fs=require('node:fs');fs.mkdirSync(process.env.AGATA_EVIDENCE,{recursive:true});
  await page.screenshot({path:process.env.AGATA_EVIDENCE+'/editor-mobile.png'});
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:process.env.AGATA_EVIDENCE+'/editor.png'});
  await page.locator('#ys-home').click();await page.getByRole('button',{name:'Abrir projeto Teste SVG offline'}).waitFor();
  await page.screenshot({path:process.env.AGATA_EVIDENCE+'/workspace.png'});
 }
 assert.deepEqual(errors,[]);console.log('UI passed: navigation/modal, list loading/error/retry, responsive layout, Fabric offline, create/save/reopen component.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
