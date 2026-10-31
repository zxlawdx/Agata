const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1700,height:1100}});page.setDefaultTimeout(12000);const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto(process.env.AGATA_TEST_URL);await page.locator('#agata-create').waitFor();
 const doc=JSON.parse(fs.readFileSync('examples/android/responsive-demo.json'));
 await page.evaluate(async document=>{const project=await pywebview.api.create_project({name:'Drag responsive'});window.fixtureId=project.id;await pywebview.api.save_interface(project.id,document,0);await Vela.navigate('/android',{project_id:project.id});},doc);
 await page.locator('#ad-palette [data-palette-kind="TextLabel"]').waitFor();
 const first=doc.screens[0],second=doc.screens[1],root=first.root,button=root.children.find(n=>n.type==='Button'),card=root.children.find(n=>n.type==='Card'),box=root.children.find(n=>n.type==='Box'),free=box.children[0],row=root.children.find(n=>n.type==='Row'),grid=root.children.find(n=>n.type==='Grid');
 const save=async()=>{await page.locator('#ad-save').click();await page.waitForFunction(()=>document.querySelector('#ad-dirty').textContent.includes('Salvo'));return page.evaluate(async()=>(await pywebview.api.get_interface(fixtureId)).document);};
 const drag=async(source,target,dx=.5,dy=.5)=>{
  await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();const a=await source.boundingBox(),b=await target.boundingBox();assert.ok(a&&b);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width*dx,b.y+b.height*dy,{steps:14});await page.mouse.up();
 };
 // Reorder directly in the tree. Place the Button before the TextField.
 await drag(page.locator(`[data-tree-node="${button.id}"]`),page.locator(`[data-tree-node="${root.children[1].id}"]`),.5,.03);
 let stored=await save();assert.equal(stored.screens[0].root.children[1].id,button.id);
 // Reparent into Card using canvas hit testing, preserving its navigation event.
 await drag(page.locator(`[data-tree-node="${button.id}"]`),page.locator(`[data-node-id="${card.id}"]`),.8,.7);
 stored=await save();let cardNow=stored.screens[0].root.children.find(n=>n.id===card.id);assert.ok(cardNow.children.some(n=>n.id===button.id));assert.equal(cardNow.children.find(n=>n.id===button.id).events.onClick.target,second.id);
 // A real palette drop creates one subtree with new IDs.
 await drag(page.locator('[data-palette-kind="TextLabel"]'),page.locator(`[data-node-id="${card.id}"]`),.8,.8);
 stored=await save();cardNow=stored.screens[0].root.children.find(n=>n.id===card.id);assert.equal(cardNow.children.length,4);
 // Invalid destination/cycle leaves the document unchanged.
 const before=JSON.stringify(cardNow);
 await drag(page.locator(`[data-tree-node="${card.id}"]`),page.locator(`[data-tree-node="${button.id}"]`),.5,.5);
 stored=await save();assert.equal(JSON.stringify(stored.screens[0].root.children.find(n=>n.id===card.id)),before);
 // Move an existing component to another Screen through the tree/canvas.
 await drag(page.locator(`[data-tree-node="${button.id}"]`),page.locator(`[data-frame-id="${second.id}"] .ad-screen-content`),.5,.4);
 stored=await save();assert.ok(stored.screens[1].root.children.some(n=>n.id===button.id));
 await page.locator('#ad-undo').click();stored=await save();assert.ok(stored.screens[0].root.children.find(n=>n.id===card.id).children.some(n=>n.id===button.id));
 await page.locator('#ad-redo').click();stored=await save();assert.ok(stored.screens[1].root.children.some(n=>n.id===button.id));
 // Scroll the Screen to a free Box, move a child, then resize it.
 await page.locator(`#ad-screens [data-screen-id="${first.id}"]`).click();
 await drag(page.locator(`[data-tree-node="${free.id}"]`),page.locator(`[data-node-id="${box.id}"]`),.35,.55);
 stored=await save();const moved=stored.screens[0].root.children.find(n=>n.id===box.id).children.find(n=>n.id===free.id);assert.ok(moved.layout.x>16&&moved.layout.y>16);assert.equal(moved.layout.x%8,0);
 await page.locator(`[data-tree-node="${free.id}"]`).click();await page.locator(`[data-resize-node="${free.id}"]`).scrollIntoViewIfNeeded();
 const handle=await page.locator(`[data-resize-node="${free.id}"]`).boundingBox();await page.mouse.move(handle.x+5,handle.y+5);await page.mouse.down();await page.mouse.move(handle.x+65,handle.y+30,{steps:8});await page.mouse.up();
 stored=await save();assert.ok(stored.screens[0].root.children.find(n=>n.id===box.id).children.find(n=>n.id===free.id).layout.width>120);
 // Preview reflows the same model. No visual canvas scale is used.
 await page.locator('[data-mode="preview"]').click();await page.locator('#ad-preview-preset').selectOption('320,640');
 const cardPreview=page.locator(`#ad-preview-screen [data-node-id="${card.id}"]`);
 const compactWidth=await cardPreview.evaluate(e=>e.getBoundingClientRect().width);assert.ok(compactWidth>=200&&compactWidth<=290,'Compact Card width: '+compactWidth);
 await page.locator('#ad-preview-preset').selectOption('768,1024');
 assert.equal(Math.round(await cardPreview.evaluate(e=>e.getBoundingClientRect().width)),360);
 const columns=await page.locator(`#ad-preview-screen [data-node-id="${grid.id}"]`).evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,2);
 const weights=await page.locator(`#ad-preview-screen [data-node-id="${row.id}"]`).evaluate(e=>[...e.children].filter(n=>n.dataset.nodeId).map(n=>n.getBoundingClientRect().width));assert.ok(Math.abs(weights[1]/weights[0]-2)<.06);
 await page.locator('#ad-font-scale').selectOption('1.5');assert.equal(await page.locator(`#ad-preview-screen [data-node-id="${root.children[0].id}"]`).evaluate(e=>getComputedStyle(e).fontSize),'33px');
 await page.locator('#ad-preview-rotate').click();assert.equal(await page.locator('#ad-preview-width').inputValue(),'1024');
 // Overflow diagnostics come from measured geometry.
 await page.locator('[data-mode="design"]').click();await page.locator(`[data-tree-node="${card.id}"]`).click();await page.locator('[data-property="maxWidth"]').fill('900');await page.locator('[data-property="maxWidth"]').press('Tab');await page.locator('[data-property="minWidth"]').fill('700');await page.locator('[data-property="minWidth"]').press('Tab');
 await page.locator('[data-mode="preview"]').click();await page.locator('#ad-preview-preset').selectOption('320,640');await page.getByText(/Componente ultrapassa o contêiner/).first().waitFor();
 // Restore, save/reopen and export both backends with responsive semantics.
 await page.locator('[data-mode="design"]').click();await page.locator('[data-property="minWidth"]').fill('200');await page.locator('[data-property="minWidth"]').press('Tab');await page.locator('[data-property="maxWidth"]').fill('360');await page.locator('[data-property="maxWidth"]').press('Tab');
 stored=await save();await page.evaluate(()=>Vela.navigate('/android',{project_id:fixtureId}));await page.locator('#ad-palette [data-palette-kind="TextLabel"]').waitFor();
 for(const backend of ['compose','xml']){await page.locator('#ad-export-'+backend).click();await page.locator('#ad-toast').filter({hasText:'android-'+backend}).waitFor().catch(async e=>{throw Error(e.message+'; toast: '+await page.locator('#ad-toast').textContent());});}
 if(process.env.AGATA_EVIDENCE){await page.locator('#ad-toast [aria-label="Fechar notificação"]').click();fs.mkdirSync(process.env.AGATA_EVIDENCE,{recursive:true});await page.locator('#ad-fit').click();await page.screenshot({path:process.env.AGATA_EVIDENCE+'/drag-responsive-design.png'});await page.locator('[data-mode="preview"]').click();await page.locator('#ad-preview-preset').selectOption('768,1024');await page.screenshot({path:process.env.AGATA_EVIDENCE+'/drag-responsive-tablet.png'});}
 assert.deepEqual(errors,[]);await browser.close();console.log('Pointer + responsive UI passed: reorder, palette, reparent, cycle rejection, cross-Screen, undo/redo, free move/resize, constraints, weighted row, grid, font scale, overflow, round-trip and exports.');
})().catch(e=>{console.error(e);process.exit(1)});
