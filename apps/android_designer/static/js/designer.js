/* Orchestrates semantic commands, workspace, inspector, preview and source files. */
window.AgataAndroidDesigner={async mount(root){
 'use strict';if(root.dataset.mounted)return;root.dataset.mounted='1';
 const $=id=>root.querySelector('#'+id),M=window.AgataUIModel,R=window.AgataUIRenderer;
 const abort=new AbortController(),on=(e,type,fn)=>e.addEventListener(type,fn,{signal:abort.signal});
 const api=window.pywebview.api,notifications=window.AgataNotifications.create($('ad-toast'));
 const message=(text,error=false)=>notifications.show(text,{error});
 const registry=await (await fetch(root.dataset.registry)).json();
 const loaded=await api.get_interface(root.dataset.projectId);if(!root.isConnected)return;
 const model=new M.Document(loaded.document,registry);let revision=loaded.revision,screenId=model.value.start_screen;
 let selected=new Set(),clipboard=[],mode='design',zoom=model.value.viewport?.zoom||.8,showLinks=true,disposed=false,saving=false;
 let previewStack=[model.value.start_screen],previewState={},files={},filePath='',codeEditor=null,codeUpdating=false,customMode=false,generation=0,modelDraft=null,modelDraftBase='',generationTimer=null;
 const screen=()=>model.value.screens.find(s=>s.id===screenId)||model.value.screens[0];
 const chosen=()=>[...selected].map(id=>model.find(id)).filter(Boolean);
 function dirty(){ $('ad-dirty').textContent=model.dirty?'● Alterações não salvas':'✓ Salvo';$('ad-undo').disabled=!model.past.length;$('ad-redo').disabled=!model.future.length; }
 function transact(fn){model.transact(fn);render();}
 function selectNode(id,multi=false){if(!multi)selected.clear();if(multi&&selected.has(id))selected.delete(id);else selected.add(id);const found=model.find(id);if(found)screenId=found.screen.id;render();}
 function selectScreen(id){screenId=id;selected.clear();render();}
 function render(){
  if(disposed)return;dirty();renderScreens();renderTree();renderWorkspace();renderInspector();
  if(mode==='preview')renderPreview();
  if(mode==='split'){clearTimeout(generationTimer);generationTimer=setTimeout(generate,250);}
 }
 function renderScreens(){
  $('ad-screens').replaceChildren();for(const s of model.value.screens){const b=R.el('button',s.id===screen().id?'active':'',s.name+(s.id===model.value.start_screen?' · Inicial':''));b.dataset.screenId=s.id;b.onclick=()=>selectScreen(s.id);$('ad-screens').append(b);}
 }
 function renderTree(){
  const host=$('ad-tree');host.replaceChildren();
  const visit=(n,depth)=>{const b=R.el('button',selected.has(n.id)?'active':'',n.name+(n.role?' · '+n.role:''));b.setAttribute('role','treeitem');b.setAttribute('aria-selected',String(selected.has(n.id)));b.style.paddingLeft=(8+depth*12)+'px';b.dataset.treeNode=n.id;b.onclick=e=>selectNode(n.id,e.ctrlKey||e.metaKey);host.append(b);n.children.forEach(c=>visit(c,depth+1));};visit(screen().root,0);
 }
 function renderWorkspace(){
  const s=screen(),host=$('ad-frames');host.replaceChildren();let maxX=1600,maxY=1200;
  for(const item of model.value.screens){
   maxX=Math.max(maxX,item.position.x+item.width+200);maxY=Math.max(maxY,item.position.y+item.height+200);
   const frame=R.el('section','ad-frame'+(item.id===s.id?' ad-active-frame':''));frame.dataset.frameId=item.id;
   Object.assign(frame.style,{left:item.position.x+'px',top:item.position.y+'px',width:item.width+'px'});
   const title=R.el('button','ad-frame-title',item.name);title.type='button';title.title='Arraste para mover a Screen';
   title.onclick=()=>selectScreen(item.id);title.onpointerdown=e=>moveScreen(e,item,frame);
   const content=R.el('div','ad-screen-content');content.style.height=item.height+'px';
   content.append(R.render(item.root,{selected,select:selectNode,editText:n=>{const value=window.prompt('Editar texto',n.props.text);if(value!==null)transact(()=>n.props.text=value);}}));
   frame.append(title,content);host.append(frame);
  }
  $('ad-space').style.width=maxX*zoom+'px';$('ad-space').style.height=maxY*zoom+'px';
  host.style.width=maxX+'px';host.style.height=maxY+'px';host.style.transform=`scale(${zoom})`;
  const svg=$('ad-links');svg.style.width=maxX+'px';svg.style.height=maxY+'px';svg.style.transform=`scale(${zoom})`;svg.replaceChildren();svg.hidden=!showLinks;
  const defs=document.createElementNS(svg.namespaceURI,'defs');const marker=document.createElementNS(svg.namespaceURI,'marker');marker.id='ad-arrow';marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','7');marker.setAttribute('markerHeight','7');marker.setAttribute('orient','auto-start-reverse');const tip=document.createElementNS(svg.namespaceURI,'path');tip.setAttribute('d','M0 0L10 5L0 10Z');tip.setAttribute('fill','#5a276c');marker.append(tip);defs.append(marker);svg.append(defs);
  for(const source of model.value.screens)M.walk(source.root,n=>{
   const event=n.events.onClick;if(event?.action!=='navigate')return;
   const target=model.value.screens.find(s=>s.id===event.target);if(!target)return;
   const x=source.position.x+source.width,y=source.position.y+40,tx=target.position.x,ty=target.position.y+40;
   const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('marker-end','url(#ad-arrow)');line.setAttribute('d',`M${x} ${y} C${x+100} ${y},${tx-100} ${ty},${tx} ${ty}`);line.setAttribute('class','ad-connection');line.dataset.sourceNode=n.id;
   const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=n.name+' → '+target.name;line.append(title);line.onclick=()=>selectNode(n.id);svg.append(line);
  });
  $('ad-zoom').value=Math.round(zoom*100)+'%';
 }
 function moveScreen(event,item,frame){
  if(event.button!==0)return;event.stopPropagation();const start={x:event.clientX,y:event.clientY,...item.position};const old={...item.position};let position=old;
  frame.setPointerCapture(event.pointerId);
  const move=e=>{position={x:Math.max(0,old.x+(e.clientX-event.clientX)/zoom),y:Math.max(0,old.y+(e.clientY-event.clientY)/zoom)};frame.style.left=position.x+'px';frame.style.top=position.y+'px';};
  const end=()=>{frame.removeEventListener('pointermove',move);frame.removeEventListener('pointerup',end);frame.removeEventListener('pointercancel',end);screenId=item.id;transact(()=>item.position=position);};
  frame.addEventListener('pointermove',move);frame.addEventListener('pointerup',end);frame.addEventListener('pointercancel',end);
 }
 function field(host,label,value,update,options){
  const wrap=R.el('label','ad-field');wrap.append(R.el('span','',label));let control;
  if(Array.isArray(options)){control=R.el('select');for(const choice of options){const option=R.el('option','',String(choice));option.value=choice;control.append(option);}}
  else control=R.el(typeof value==='string'&&value.length>80?'textarea':'input');
  if(!options&&control.tagName==='INPUT')control.type=typeof value==='boolean'?'checkbox':typeof value==='number'?'number':/^#[\da-f]{6}$/i.test(value)?'color':'text';
  control.dataset.property=label;if(typeof value==='boolean')control.checked=value;else control.value=value;
  control.onchange=()=>transact(()=>update(typeof value==='boolean'?control.checked:typeof value==='number'?Number(control.value):control.value));wrap.append(control);host.append(wrap);return control;
 }
 function renderInspector(){
  const host=$('ad-inspector');host.replaceChildren();
  field(host,'Namespace',model.value.namespace,v=>model.value.namespace=v);
  field(host,'Aplicativo',model.value.app_name,v=>model.value.app_name=v);
  const s=screen();field(host,'Screen',s.name,v=>s.name=v);
  field(host,'Largura da Screen',s.width,v=>s.width=v);field(host,'Altura da Screen',s.height,v=>s.height=v);
  const initial=R.el('button','','Usar como Screen inicial');initial.onclick=()=>transact(d=>model.value.start_screen=s.id);host.append(initial);
  field(host,'Cor primária',model.value.theme.primary,v=>model.value.theme.primary=v);
  field(host,'Modo de tema',model.value.theme.darkMode,v=>model.value.theme.darkMode=v,['system','light','dark']);
  field(host,'Dynamic Color',model.value.theme.dynamicColor,v=>model.value.theme.dynamicColor=v);
  const current=chosen()[0];if(!current){host.append(R.el('p','','Selecione um componente ou filho para editar.'));return;}
  const n=current.node;host.append(R.el('h4','',n.type+' · '+n.id.slice(0,12)));
  field(host,'Nome',n.name,v=>n.name=v);
  field(host,'Papel',n.role,v=>n.role=v,['','title','subtitle','navigation','action','header','label','description','icon','leading','trailing','item','content']);
  const enums={variant:['filled','outlined','text','tonal','elevated'],keyboard:['text','email','number','password','phone'],align:['start','center','end'],icon:['none','menu','back','home','search','close','settings','plus']};
  for(const [key,value] of Object.entries(n.props)){
   if(key==='source'){
    const input=R.el('input');input.type='file';input.accept='image/png';input.setAttribute('aria-label','Imagem PNG local');input.onchange=async()=>{const file=input.files[0];if(!file)return;if(file.size>2_000_000){message('Imagem deve ter até 2 MB.',true);return;}const reader=new FileReader();reader.onload=()=>transact(()=>n.props.source=reader.result);reader.readAsDataURL(file);};host.append(input);
   }else field(host,key,value,v=>n.props[key]=v,enums[key]);
  }
  host.append(R.el('h4','','Layout'));
  for(const [key,value] of Object.entries(n.layout)){
   const options={alignment:['start','center','end'],arrangement:['start','center','end','spaceBetween'],scroll:['none','vertical','horizontal']}[key];
   field(host,key,value,v=>{n.layout[key]=['width','height'].includes(key)&&!['fill','wrap'].includes(v)?Number(v):v;},options);
  }
  host.append(R.el('h4','','Evento onClick'));
  const actions=R.el('select');actions.setAttribute('aria-label','Destino da navegação');
  for(const [value,label] of [['','Sem ação'],['back','Voltar'],...model.value.screens.map(s=>[s.id,s.name])]){const option=R.el('option','',label);option.value=value;actions.append(option);}
  actions.value=n.events.onClick?.action==='back'?'back':n.events.onClick?.target||'';
  actions.onchange=()=>transact(()=>{if(!actions.value)delete n.events.onClick;else n.events.onClick=actions.value==='back'?{action:'back'}:{action:'navigate',target:actions.value};});host.append(actions);
 }
 function setZoom(value,clientX,clientY){
  const host=$('ad-workspace'),rect=host.getBoundingClientRect(),old=zoom;
  const x=clientX===undefined?host.clientWidth/2:clientX-rect.left,y=clientY===undefined?host.clientHeight/2:clientY-rect.top;
  const px=(host.scrollLeft+x)/old,py=(host.scrollTop+y)/old;zoom=Math.max(.15,Math.min(2.5,value));renderWorkspace();host.scrollLeft=px*zoom-x;host.scrollTop=py*zoom-y;
 }
 function fit(){const host=$('ad-workspace'),screens=model.value.screens,maxX=Math.max(...screens.map(s=>s.position.x+s.width))+80,maxY=Math.max(...screens.map(s=>s.position.y+s.height))+80;setZoom(Math.min(host.clientWidth/maxX,host.clientHeight/maxY));host.scrollTo(0,0);}
 function removeSelected(){
  const nodes=chosen().filter(c=>c.parent);transact(()=>{for(const c of nodes)c.parent.children=c.parent.children.filter(n=>n.id!==c.node.id);});selected.clear();render();
 }
 async function save(){
  if(saving)return;saving=true;$('ad-save').disabled=true;
  try{
   model.value.viewport={zoom,x:$('ad-workspace').scrollLeft,y:$('ad-workspace').scrollTop};
   const snapshot=M.clone(model.value),result=await api.save_interface(root.dataset.projectId,snapshot,revision);
   if(disposed)return;revision=result.revision;model.saved=JSON.stringify(snapshot);dirty();message('Interface salva no computador.');
  }catch(e){message(e.message,true);throw e;}finally{saving=false;if(!disposed)$('ad-save').disabled=false;}
 }
 function renderPreview(){
  const active=model.value.screens.find(s=>s.id===previewStack.at(-1))||model.value.screens.find(s=>s.id===model.value.start_screen);
  $('ad-preview-name').value=active.name;$('ad-preview-screen').style.width=active.width+'px';$('ad-preview-screen').style.minHeight=active.height+'px';
  $('ad-preview-screen').replaceChildren(R.render(active.root,{preview:true,state:previewState,action:e=>{if(e.action==='back'){if(previewStack.length>1)previewStack.pop();}else if(model.value.screens.some(s=>s.id===e.target))previewStack.push(e.target);renderPreview();}}));
 }
 function ensureEditor(){if(codeEditor)return;codeEditor=window.AgataCodeEditor.create($('ad-code-editor'),(text)=>{
  if(codeUpdating)return;
  if($('ad-backend').value==='model'){ if(modelDraft===null)modelDraftBase=JSON.stringify(model.value);modelDraft=text;$('ad-code-note').textContent='JSON modificado. Aplicar JSON ao Design valida o schema antes de alterar a interface.'; }
  else if(customMode&&filePath){model.transact(d=>d.custom_files[$('ad-backend').value+'/'+filePath]=text);dirty();}
 });}
 function showFile(){
  ensureEditor();filePath=$('ad-file').value;customMode=!!model.value.custom_files[$('ad-backend').value+'/'+filePath];
  const isModel=$('ad-backend').value==='model';codeUpdating=true;codeEditor.setValue(isModel?(modelDraft??JSON.stringify(model.value,null,2)):(model.value.custom_files[$('ad-backend').value+'/'+filePath]??files[filePath]??''),isModel?'json':filePath.endsWith('.xml')?'xml':filePath.endsWith('.kt')||filePath.endsWith('.kts')?'kotlin':'text',isModel||customMode);codeUpdating=false;
  $('ad-code-note').textContent=isModel?'IR JSON: Aplicar JSON valida e sincroniza com Design.':customMode?'Código personalizado preservado. Alterações não voltam ao Design.':'Código gerado, somente leitura. Personalizar cria override explícito sem sincronização reversa.';
 }
 async function generate(){
  ensureEditor();$('ad-code-error').textContent='';const current=++generation;
  try{
   if($('ad-backend').value==='model')files={'agata-model.json':JSON.stringify(model.value,null,2)};
   else{const result=await api.generate_android(model.value,$('ad-backend').value);if(disposed||current!==generation)return;files=result;}
   $('ad-file').replaceChildren();for(const path of Object.keys(files)){const option=R.el('option','',path);option.value=path;$('ad-file').append(option);}showFile();
  }catch(e){$('ad-code-error').textContent=e.message;}
 }
 async function setMode(next){
  mode=next;root.dataset.mode=mode;
  for(const button of root.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
  $('ad-workspace').hidden=!['design','split'].includes(mode);$('ad-workspace-tools').hidden=!['design','split'].includes(mode);$('ad-code').hidden=!['code','split'].includes(mode);$('ad-preview').hidden=mode!=='preview';
  if(mode==='preview'){previewStack=[model.value.start_screen];previewState={};renderPreview();}
  if(['code','split'].includes(mode))await generate();
 }
 // One command path per UI action; all edits go through semantic history.
 on($('ad-save'),'click',()=>save().catch(()=>{}));
 const leave=path=>{if(model.dirty&&!window.confirm('Existem alterações não salvas. Sair sem salvar?'))return;window.Vela.navigate(path,path==='/home'?{}:{project_id:root.dataset.projectId});};
 on($('ad-home'),'click',()=>leave('/home'));on($('ad-drawing'),'click',()=>leave('/sketch'));
 on($('ad-new-screen'),'click',()=>{screenId=model.addScreen().id;selected.clear();render();});
 on($('ad-duplicate-screen'),'click',()=>{screenId=model.duplicateScreen(screen()).id;selected.clear();render();});
 on($('ad-delete-screen'),'click',()=>{try{model.deleteScreen(screen());screenId=model.value.start_screen;selected.clear();render();}catch(e){message(e.message,true);}});
 for(const kind of Object.keys(registry)){const option=R.el('option','',kind);option.value=kind;$('ad-component-kind').append(option);}
 const childOption=R.el('label','','Inserir como filho selecionado '),childCheck=R.el('input');childCheck.type='checkbox';childCheck.id='ad-as-child';childOption.append(childCheck);$('ad-add-component').before(childOption);
 on($('ad-add-component'),'click',()=>{
  let parent=screen().root;if(childCheck.checked){const n=chosen()[0]?.node;if(!n||!registry[n.type].container){message('Selecione um contêiner para inserir filhos.',true);return;}parent=n;}
  const n=M.node(registry,$('ad-component-kind').value);transact(()=>parent.children.push(n));selectNode(n.id);
 });
 on($('ad-copy'),'click',()=>{clipboard=chosen().filter(c=>c.parent).map(c=>M.clone(c.node));message('Componentes copiados. Selecione outra Screen para colar.');});
 on($('ad-paste'),'click',()=>{transact(()=>screen().root.children.push(...clipboard.map(n=>model.cloneNode(n))));});
 on($('ad-duplicate'),'click',()=>{transact(()=>{for(const c of chosen().filter(c=>c.parent))c.parent.children.splice(c.parent.children.indexOf(c.node)+1,0,model.cloneNode(c.node));});});
 on($('ad-delete'),'click',removeSelected);
 for(const [id,step] of [['ad-up',-1],['ad-down',1]])on($(id),'click',()=>transact(()=>{for(const c of chosen().filter(c=>c.parent)){const a=c.parent.children,index=a.indexOf(c.node),target=index+step;if(target>=0&&target<a.length)[a[index],a[target]]=[a[target],a[index]];}}));
 on($('ad-undo'),'click',()=>{model.undo();render();});on($('ad-redo'),'click',()=>{model.redo();render();});
 for(const b of root.querySelectorAll('[data-mode]'))on(b,'click',()=>setMode(b.dataset.mode));
 on($('ad-zoom-in'),'click',()=>setZoom(zoom*1.2));on($('ad-zoom-out'),'click',()=>setZoom(zoom/1.2));on($('ad-fit'),'click',fit);on($('ad-reset'),'click',()=>{zoom=.8;renderWorkspace();$('ad-workspace').scrollTo(0,0);});
 on($('ad-grid'),'click',()=>{$('ad-workspace').classList.toggle('ad-no-grid');$('ad-grid').setAttribute('aria-pressed',String(!$('ad-workspace').classList.contains('ad-no-grid')));});
 on($('ad-connections'),'click',()=>{showLinks=!showLinks;$('ad-connections').setAttribute('aria-pressed',String(showLinks));renderWorkspace();});
 on($('ad-workspace'),'wheel',event=>{if(event.ctrlKey||event.metaKey){event.preventDefault();setZoom(zoom*Math.exp(-event.deltaY*.002),event.clientX,event.clientY);}});
 on($('ad-workspace'),'pointerdown',event=>{if(event.button!==1)return;event.preventDefault();const h=$('ad-workspace'),x=event.clientX,y=event.clientY,left=h.scrollLeft,top=h.scrollTop;h.setPointerCapture(event.pointerId);const move=e=>{h.scrollLeft=left+x-e.clientX;h.scrollTop=top+y-e.clientY;};const stop=()=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',stop);};h.addEventListener('pointermove',move);h.addEventListener('pointerup',stop);});
 on($('ad-connect'),'pointerdown',event=>{
  const source=chosen()[0];if(!source){message('Selecione primeiro o componente de origem.',true);return;}event.preventDefault();
  const finish=e=>{document.removeEventListener('pointerup',finish);const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-frame-id]');if(target){transact(()=>source.node.events.onClick={action:'navigate',target:target.dataset.frameId});message('Conexão de navegação criada.');}else message('Solte sobre a Screen de destino.',true);};document.addEventListener('pointerup',finish,{once:true,signal:abort.signal});
 });
 on($('ad-preview-back'),'click',()=>{if(previewStack.length>1)previewStack.pop();renderPreview();});on($('ad-preview-reset'),'click',()=>{previewStack=[model.value.start_screen];previewState={};renderPreview();});
 on($('ad-generate'),'click',generate);on($('ad-backend'),'change',generate);on($('ad-file'),'change',showFile);
 on($('ad-customize'),'click',()=>{
  if($('ad-backend').value==='model')return;
  if(!/^app\/src\/main\/(java\/[a-zA-Z0-9_/]+\.kt|res\/(layout|values)\/[a-z0-9_]+\.xml)$/.test(filePath)){message('Somente arquivos Kotlin e XML de aplicação podem ser personalizados.',true);return;}
  model.transact(d=>d.custom_files[$('ad-backend').value+'/'+filePath]=files[filePath]);showFile();dirty();
 });
 on($('ad-apply-model'),'click',async()=>{
  if($('ad-backend').value!=='model')return;try{if(modelDraft!==null&&modelDraftBase!==JSON.stringify(model.value))throw Error('O Design mudou desde o início deste rascunho. Preserve seu JSON e descarte o rascunho antes de tentar novamente.');const value=JSON.parse(codeEditor.getValue());await api.validate_interface(value);modelDraft=null;transact(()=>model.value=value);$('ad-code-error').textContent='';}catch(e){$('ad-code-error').textContent=e.message;}
 });
 on($('ad-discard-json'),'click',()=>{modelDraft=null;showFile();});
 on($('ad-format-json'),'click',()=>{try{codeEditor.setValue(JSON.stringify(JSON.parse(codeEditor.getValue()),null,2),'json',true);}catch(e){$('ad-code-error').textContent=e.message;}});
 for(const backend of ['xml','compose'])on($('ad-export-'+backend),'click',async()=>{try{await save();const result=await api.export_android(root.dataset.projectId,backend);if(!disposed)message('Exportado: '+result.path);}catch(e){if(!disposed)message(e.message,true);}});
 on($('ad-example'),'click',()=>{
  const first=screen(),second=model.addScreen();second.name='Dashboard';second.root.children=[M.node(registry,'TextLabel',{text:'Dashboard',fontSize:24,bold:true})];
  const top=M.node(registry,'TopBar'),card=M.node(registry,'Card'),field=M.node(registry,'TextField'),button=M.node(registry,'Button'),bottom=M.node(registry,'BottomBar');
  button.children.find(c=>c.type==='TextLabel').props.text='Entrar';button.events.onClick={action:'navigate',target:second.id};
  bottom.children[1].children.find(c=>c.type==='TextLabel').props.text='Dashboard';bottom.children[1].events.onClick={action:'navigate',target:second.id};
  transact(()=>first.root.children.push(top,card,field,button,bottom));screenId=first.id;selected=new Set([button.id]);render();fit();
 });
 on(document,'keydown',event=>{
  if(!root.isConnected||event.target.closest('input,textarea,.cm-editor,select'))return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save().catch(()=>{});}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(event.shiftKey)model.redo();else model.undo();render();}
  if(event.key==='Delete'&&mode==='design'){event.preventDefault();removeSelected();}
 });
 window.VelaPage={...(window.VelaPage||{}),beforeUnmount(){disposed=true;clearTimeout(generationTimer);abort.abort();notifications.dispose();codeEditor?.destroy();}};
 render();await setMode('design');
 if(model.value.viewport){$('ad-workspace').scrollTo(model.value.viewport.x,model.value.viewport.y);}else fit();
}};
