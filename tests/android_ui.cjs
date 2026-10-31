const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(12000);const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto(process.env.AGATA_TEST_URL);await page.locator('#agata-create').waitFor();
 await page.evaluate(async()=>{const p=await pywebview.api.create_project({name:'Android semantic test',platform:'android'});window.fixtureId=p.id;await Vela.navigate('/android',{project_id:p.id});});
 await page.getByText('Selecione um componente ou filho para editar.').waitFor();
 await page.locator('#ad-example').click();assert.equal(await page.locator('#ad-screens button').count(),2);
 await page.locator('.ad-frame').first().locator('.ui-Card .ui-TextLabel').first().click();
 await page.locator('[data-property="text"]').fill('Bem-vindo editado');await page.locator('[data-property="text"]').press('Tab');
 await page.locator('.ui-Card').getByText('Bem-vindo editado').waitFor();
 await page.locator('.ad-frame').first().locator('.ui-TopBar .ui-Icon').click();
 await page.locator('[data-property="icon"]').selectOption('back');
 // Select button through tree, edit its independent label and restore a route.
 await page.locator('.ad-frame').first().getByText('Entrar',{exact:true}).click();
 await page.locator('[data-property="text"]').fill('Entrar agora');await page.locator('[data-property="text"]').press('Tab');
 await page.locator('#ad-save').click();await page.getByText('Interface salva no computador.').waitFor();
 let doc=await page.evaluate(async()=> (await pywebview.api.get_interface(fixtureId)).document);
 const first=doc.screens[0],dashboard=doc.screens[1],button=first.root.children.find(n=>n.type==='Button');
 assert.equal(button.children.find(n=>n.type==='TextLabel').props.text,'Entrar agora');assert.equal(first.root.children.find(n=>n.type==='TopBar').children[0].props.icon,'back');
 // Disabled buttons must reject mouse and keyboard navigation alike.
 await page.locator(`[data-tree-node="${button.id}"]`).click();await page.locator('[data-property="enabled"]').uncheck();
 await page.locator('[data-mode="preview"]').click();await page.locator('#ad-preview-screen .ui-Button').click({force:true});await page.locator('#ad-preview-screen .ui-Button').press('Enter');
 assert.equal(await page.locator('#ad-preview-name').textContent(),'Tela Inicial');
 await page.locator('[data-mode="design"]').click();await page.locator('[data-property="enabled"]').check();
 // A connector drag creates a semantic onClick and a selectable path, not a drawing.
 await page.locator(`[data-tree-node="${button.id}"]`).click();
 const from=await page.locator('#ad-connect').boundingBox();const to=await page.locator(`[data-frame-id="${dashboard.id}"] .ad-frame-title`).boundingBox();
 await page.mouse.move(from.x+10,from.y+10);await page.mouse.down();await page.mouse.move(to.x+20,to.y+10,{steps:5});await page.mouse.up();
 assert.ok(await page.locator('#ad-links path').count());
 await page.locator('[data-mode="preview"]').click();await page.locator('#ad-preview').getByText('Entrar agora',{exact:true}).click();
 await page.locator('#ad-preview-screen').getByText('Dashboard',{exact:true}).waitFor();
 await page.locator('#ad-preview-back').click();await page.locator('#ad-preview-screen').getByText('Bem-vindo editado').waitFor();
 await page.locator('[data-mode="design"]').click();
 await page.locator('#ad-duplicate-screen').click();assert.equal(await page.locator('#ad-screens button').count(),3);
 await page.locator('#ad-undo').click();assert.equal(await page.locator('#ad-screens button').count(),2);
 await page.locator('#ad-redo').click();assert.equal(await page.locator('#ad-screens button').count(),3);
 await page.locator('#ad-delete-screen').click();assert.equal(await page.locator('#ad-screens button').count(),2);
 // Moving the frame changes only workspace position, and zoom remains separate.
 const title=page.locator(`[data-frame-id="${dashboard.id}"] .ad-frame-title`),box=await title.boundingBox();
 await page.mouse.move(box.x+25,box.y+10);await page.mouse.down();await page.mouse.move(box.x+65,box.y+30,{steps:4});await page.mouse.up();
 await page.locator('#ad-zoom-in').click();await page.locator('#ad-zoom-out').click();
 await page.locator(`#ad-screens [data-screen-id="${first.id}"]`).click();
 // Reopen saved document, including title/child/icon changes and navigation.
 await page.locator('#ad-save').click();await page.getByText('Interface salva no computador.').waitFor();
 await page.evaluate(()=>Vela.navigate('/android',{project_id:fixtureId}));await page.locator('.ui-Card').getByText('Bem-vindo editado').waitFor();
 await page.locator('[data-mode="code"]').click();await page.locator('.cm-content').waitFor();
 await page.waitForFunction(()=>document.querySelector('#ad-file').options.length>10);assert.ok(await page.locator('#ad-file option').count()>10);
 await page.locator('#ad-backend').selectOption('model');await page.waitForFunction(()=>document.querySelector('#ad-file').value==='agata-model.json');
 // Formal JSON round trip: change supported model text through code and apply.
 await page.locator('.cm-content').click();await page.keyboard.press('Control+Home');
 const changed=await page.evaluate(async()=>{const d=(await pywebview.api.get_interface(fixtureId)).document;d.app_name='Código sincronizado';return JSON.stringify(d,null,2)});
 await page.locator('.cm-content').fill(changed);await page.locator('#ad-apply-model').click();
 await page.waitForFunction(()=>document.querySelector('[data-property="Aplicativo"]').value==='Código sincronizado');assert.equal(await page.locator('[data-property="Aplicativo"]').inputValue(),'Código sincronizado');
 await page.locator('#ad-backend').selectOption('compose');await page.waitForFunction(()=>document.querySelector('#ad-file').value!=='agata-model.json');
 const kotlinPath=await page.locator('#ad-file option').evaluateAll(nodes=>nodes.find(n=>n.value.endsWith('MainActivity.kt')).value);
 await page.locator('#ad-file').selectOption(kotlinPath);await page.locator('#ad-customize').click();
 await page.locator('.cm-content').click();await page.keyboard.press('Control+End');await page.keyboard.insertText('\n// custom preserved\n');
 await page.locator('#ad-save').click();await page.getByText('Interface salva no computador.').waitFor();
 doc=await page.evaluate(async()=> (await pywebview.api.get_interface(fixtureId)).document);assert.match(doc.custom_files["compose/"+kotlinPath],/custom preserved/);
 for(const backend of ['xml','compose']){await page.locator('#ad-export-'+backend).click();await page.locator('#ad-toast').filter({hasText:'android-'+backend}).waitFor();}
 await page.locator('#ad-toast [aria-label="Fechar notificação"]').click();assert.equal(await page.locator('#ad-toast').isVisible(),false);
 if(process.env.AGATA_EVIDENCE){
  const fs=require('node:fs');fs.mkdirSync(process.env.AGATA_EVIDENCE,{recursive:true});
  await page.screenshot({path:process.env.AGATA_EVIDENCE+'/android-code.png'});
  await page.locator('[data-mode="design"]').click();await page.locator('#ad-fit').click();await page.screenshot({path:process.env.AGATA_EVIDENCE+'/android-design.png'});
  await page.locator('[data-mode="preview"]').click();await page.screenshot({path:process.env.AGATA_EVIDENCE+'/android-preview.png'});
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));assert.deepEqual(errors,[]);await browser.close();console.log('Android vertical slice passed: child editing, connector, preview, history, persistence, JSON/code round trip, protected custom source, XML/Compose ZIP.');
})().catch(e=>{console.error(e);process.exit(1)});
