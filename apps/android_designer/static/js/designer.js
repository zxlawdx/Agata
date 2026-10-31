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
 let previewErrors={};let previewStack=[model.value.start_screen],previewState={},files={},filePath='',codeEditor=null,codeUpdating=false,customMode=false,generation=0,modelDraft=null,modelDraftBase='',generationTimer=null;
 let explorer=null,graphicsEditor=null,desktop=null,codeWorkflow=null,navigationEditor=null;let constraintMode=false,constraintEditor=null,tour=null;let dragController=null,previewObserver=null,panelObservers=[],previewWidth=390,previewHeight=844,fontScale=1,responsiveScope='base';const collapsed=new Set();
 const screen=()=>model.value.screens.find(s=>s.id===screenId)||model.value.screens[0];
 const chosen=()=>[...selected].map(id=>model.find(id)).filter(Boolean);
 function dirty(){ $('ad-dirty').textContent=model.dirty?'● Alterações não salvas':'✓ Salvo';$('ad-undo').disabled=!model.past.length;$('ad-redo').disabled=!model.future.length; }
 function transact(fn){model.transact(fn);render();}
 function selectNode(id,multi=false){if(!multi)selected.clear();if(multi&&selected.has(id))selected.delete(id);else selected.add(id);const found=model.find(id);if(found)screenId=found.screen.id;render();}
 function selectScreen(id){screenId=id;selected.clear();render();}
 function render(){
  if(disposed)return;dirty();renderScreens();renderTree();renderLayers();renderWorkspace();renderInspector();explorer?.update();requestAnimationFrame(()=>{constraintEditor?.redraw();navigationEditor?.redraw();});
  if(mode==='preview')renderPreview();
  if(mode==='split'){clearTimeout(generationTimer);generationTimer=setTimeout(generate,250);}
 }
 function renderScreens(){
  $('ad-screens').replaceChildren();for(const s of model.value.screens){const b=R.el('button',s.id===screen().id?'active':'',s.name+(s.id===model.value.start_screen?' · Inicial':''));b.dataset.screenId=s.id;b.onclick=()=>selectScreen(s.id);$('ad-screens').append(b);}
 }
 function renderTree(){
  const host=$('ad-tree');host.replaceChildren();
  const visit=(n,depth)=>{
   const row=R.el('div','ad-tree-row');row.dataset.treeRow=n.id;row.style.paddingLeft=depth*10+'px';
   const toggle=R.el('button','ad-tree-toggle',n.children.length?(collapsed.has(n.id)?'▸':'▾'):'·');toggle.title='Expandir ou recolher';toggle.onclick=()=>{collapsed.has(n.id)?collapsed.delete(n.id):collapsed.add(n.id);renderTree();};
   const b=R.el('button',selected.has(n.id)?'active':'',n.name+(n.role?' · '+n.role:''));b.setAttribute('role','treeitem');b.setAttribute('aria-level',String(depth+1));b.setAttribute('aria-selected',String(selected.has(n.id)));b.setAttribute('aria-expanded',String(!collapsed.has(n.id)));b.dataset.treeNode=n.id;b.dataset.dragNode=n.id;b.title='Arraste para reorganizar; duplo clique para renomear';b.onclick=e=>selectNode(n.id,e.ctrlKey||e.metaKey);b.ondblclick=()=>{const name=window.prompt('Nome',n.name);if(name!==null)transact(()=>n.name=name);};
   const flag=(label,text,fn)=>{const button=R.el('button','ad-tree-flag',text);button.title=label;button.setAttribute('aria-label',label);button.onclick=fn;return button;};
   row.append(toggle,b,flag('Visibilidade',n.layout.visible?'◉':'○',()=>transact(()=>n.layout.visible=!n.layout.visible)),flag('Bloqueio',n.layout.locked?'▣':'▢',()=>transact(()=>n.layout.locked=!n.layout.locked)));
   row.oncontextmenu=e=>{e.preventDefault();selectNode(n.id);root.querySelector('#ad-context')?.remove();const menu=R.el('div','ad-context-menu');menu.id='ad-context';menu.setAttribute('role','menu');menu.style.left=e.clientX+'px';menu.style.top=e.clientY+'px';for(const [id,label] of [['copy','Copiar'],['duplicate','Duplicar'],['group','Agrupar'],['delete','Excluir'],['up','Subir'],['down','Descer']]){const action=R.el('button','',label);action.setAttribute('role','menuitem');action.onclick=()=>{$('ad-'+id).click();menu.remove();};menu.append(action);}root.append(menu);document.addEventListener('click',()=>menu.remove(),{once:true,signal:abort.signal});};
   host.append(row);if(!collapsed.has(n.id))n.children.forEach(c=>visit(c,depth+1));
  };if(screen())visit(screen().root,0);
 }
 function renderWorkspace(){
  const s=screen(),host=$('ad-frames'),scrolls=new Map([...host.querySelectorAll('[data-node-id]')].filter(e=>e.scrollTop||e.scrollLeft).map(e=>[e.dataset.nodeId,{x:e.scrollLeft,y:e.scrollTop}]));host.replaceChildren();let maxX=1600,maxY=1200;
  for(const item of model.value.screens){
   maxX=Math.max(maxX,item.position.x+item.width+200);maxY=Math.max(maxY,item.position.y+item.height+200);
   const frame=R.el('section','ad-frame'+(item.id===s.id?' ad-active-frame':''));frame.dataset.frameId=item.id;
   Object.assign(frame.style,{left:item.position.x+'px',top:item.position.y+'px',width:item.width+'px'});
   const title=R.el('button','ad-frame-title',item.name);title.type='button';title.title='Arraste para mover a Screen';
   title.onclick=()=>selectScreen(item.id);title.onpointerdown=e=>moveScreen(e,item,frame);
   const content=R.el('div','ad-screen-content');content.style.height=item.height+'px';
   content.append(R.render(AgataConstraints.layered(item).root,{width:item.width,height:item.height,selected,select:selectNode,editText:n=>{const value=window.prompt('Editar texto',n.props.text);if(value!==null)transact(()=>model.find(n.id).node.props.text=value);}}));
   frame.append(title,content);host.append(frame);
  }
  $('ad-space').style.width=maxX*zoom+'px';$('ad-space').style.height=maxY*zoom+'px';
  host.style.width=maxX+'px';host.style.height=maxY+'px';host.style.transform=`scale(${zoom})`;
  const svg=$('ad-links');svg.style.width=maxX+'px';svg.style.height=maxY+'px';svg.style.transform=`scale(${zoom})`;svg.replaceChildren();svg.hidden=!showLinks;
  const defs=document.createElementNS(svg.namespaceURI,'defs');const marker=document.createElementNS(svg.namespaceURI,'marker');marker.id='ad-arrow';marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','7');marker.setAttribute('markerHeight','7');marker.setAttribute('orient','auto-start-reverse');const tip=document.createElementNS(svg.namespaceURI,'path');tip.setAttribute('d','M0 0L10 5L0 10Z');tip.setAttribute('fill','#5a276c');marker.append(tip);defs.append(marker);svg.append(defs);
  for(const source of model.value.screens)M.walk(source.root,n=>{
   const event=n.events.onClick;if(event?.action!=='navigate')return;
   const target=model.value.screens.find(s=>s.id===event.target);if(!target)return;
   const node=host.querySelector(`[data-node-id="${n.id}"]`),hr=host.getBoundingClientRect(),r=node?.getBoundingClientRect();const x=r?(r.right-hr.left)/zoom:source.position.x+source.width,y=r?(r.top+r.height/2-hr.top)/zoom:source.position.y+40,tx=target.position.x,ty=target.position.y+40;
   const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('marker-end','url(#ad-arrow)');line.setAttribute('d',`M${x} ${y} C${x+100} ${y},${tx-100} ${ty},${tx} ${ty}`);line.setAttribute('class','ad-connection');line.dataset.sourceNode=n.id;
   const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=n.name+' → '+target.name;line.append(title);line.onclick=()=>selectNode(n.id);line.setAttribute('tabindex','0');line.setAttribute('role','button');line.setAttribute('aria-label','Editar onClick '+n.name);line.onkeydown=e=>{if(e.key==='Delete'){model.updateEvent(n.id,null);render();}};svg.append(line);const label=document.createElementNS(svg.namespaceURI,'text');label.textContent='onClick';label.setAttribute('x',(x+tx)/2);label.setAttribute('y',(y+ty)/2-8);label.setAttribute('fill','#5a276c');label.setAttribute('font-size','14');svg.append(label);
  });
  for(const [id,point] of scrolls){const e=host.querySelector(`[data-node-id="${id}"]`);if(e){e.scrollTop=point.y;e.scrollLeft=point.x;}}
  if(!model.value.screens.length){const empty=R.el('section','ad-empty-project');empty.append(R.el('h2','','Your project is ready!'),R.el('p','','No screens found. Start building your first screen.'));for(const [label,action] of [['Create Empty Screen',()=>{$('ad-new-screen').click();}],['Choose Template',()=>{model.addScreen();$('ad-example').click();}],['Open Project Settings',()=>explorer?.settings()]]){const b=R.el('button','',label);b.onclick=action;empty.append(b);}host.append(empty);}
  $('ad-zoom').value=Math.round(zoom*100)+'%';requestAnimationFrame(()=>{constraintEditor?.redraw();navigationEditor?.redraw();});
 }

 function renderConstraints(host,current){
  const n=current.node;if(current.parent?.type!=='ConstraintLayout')return;
  const section=R.el('details','ad-inspector-section');section.open=true;section.append(R.el('summary','','Constraints · layout'));host.append(section);
  for(const anchor of ['start','end','top','bottom',...(n.type==='TextLabel'?['baseline']:[])]){
   const row=R.el('div','ad-constraint-field'),link=n.layout.constraints[anchor];row.append(R.el('span','',anchor));
   const target=R.el('select');target.dataset.linkTarget=anchor;target.setAttribute('aria-label','Alvo '+anchor);
   for(const [value,label] of [['','Livre'],['parent','Pai'],...current.parent.children.filter(c=>c!==n).map(c=>[c.id,c.name])]){const o=R.el('option','',label);o.value=value;target.append(o);}target.value=link?.target||'';
   const edge=R.el('select');edge.dataset.linkAnchor=anchor;edge.setAttribute('aria-label','Âncora destino '+anchor);for(const a of anchor==='baseline'?['baseline']:['start','end'].includes(anchor)?['start','end']:['top','bottom']){const o=R.el('option','',a);o.value=a;edge.append(o);}edge.value=link?.anchor||anchor;
   const margin=R.el('input');margin.type='number';margin.min=0;margin.max=4096;margin.value=link?.margin||0;margin.setAttribute('aria-label','Margem '+anchor);margin.dataset.linkMargin=anchor;
   const update=()=>{try{model.setConstraint(n.id,anchor,target.value?{target:target.value,anchor:edge.value,margin:Number(margin.value)}:null);document.dispatchEvent(new CustomEvent('agata:action',{detail:'constraint'}));render();}catch(e){message(e.message,true);render();}};target.onchange=edge.onchange=margin.onchange=update;row.append(target,edge,margin);section.append(row);
  }
  for(const key of ['horizontalBias','verticalBias']){const control=R.el('input');control.type='range';control.min=0;control.max=1;control.step=.01;control.value=n.layout[key];control.setAttribute('aria-label','Ajustar '+key);control.onchange=()=>transact(()=>n.layout[key]=Number(control.value));section.append(control);}
  const action=R.el('button','','Centralizar com bias 0,5');action.onclick=()=>{try{model.centerNode(n.id);document.dispatchEvent(new CustomEvent('agata:action',{detail:'center'}));render();}catch(e){message(e.message,true);}};section.append(action);
  const free=R.el('button','','Manter posição livre (remover links)');free.onclick=()=>{const view=root.querySelector(`#ad-frames [data-node-id="${n.id}"]`);const x=view?.offsetLeft||0,y=view?.offsetTop||0;transact(()=>{n.layout.constraints={};n.layout.x=x;n.layout.y=y;});};section.append(free);
  if(model.locked(n.id))for(const input of section.querySelectorAll('input,select,button'))input.disabled=true;
  requestAnimationFrame(()=>{const element=root.querySelector(`#ad-frames [data-node-id="${current.parent.id}"]`);for(const warning of element?._constraintWarnings||[]){const p=R.el('p','ad-constraint-warning',warning.message);section.append(p);}});
 }
 function renderLayers(){
  const host=$('ad-layers');host.replaceChildren();const s=screen();
  for(const [index,l] of (s?.layers||[]).entries()){
   const row=R.el('div','ad-layer');row.dataset.layerId=l.id;
   const select=R.el('button','',l.name);select.onclick=()=>{selected=new Set(l.nodes);render();};select.ondblclick=()=>{const name=prompt('Nome da camada',l.name);if(name)transact(()=>l.name=name);};row.append(select);
   for(const [label,key] of [['Visível','visible'],['Bloqueada','locked']]){const check=R.el('input');check.type='checkbox';check.checked=l[key];check.setAttribute('aria-label',label+' '+l.name);check.onchange=()=>transact(()=>l[key]=check.checked);row.append(check);}
   const opacity=R.el('input');opacity.type='range';opacity.min=0;opacity.max=1;opacity.step=.05;opacity.value=l.opacity;opacity.setAttribute('aria-label','Opacidade '+l.name);opacity.onchange=()=>transact(()=>l.opacity=Number(opacity.value));row.append(opacity);
   for(const [label,step] of [['↑',-1],['↓',1]]){const b=R.el('button','',label);b.setAttribute('aria-label','Mover camada '+label);b.onclick=()=>transact(()=>{const next=Math.max(0,Math.min(s.layers.length-1,index+step));s.layers.splice(index,1);s.layers.splice(next,0,l);});row.append(b);}
   const duplicate=R.el('button','','Duplicar');duplicate.onclick=()=>{try{const sources=model.topNodes(l.nodes);model.transact(()=>{const copies=sources.map(c=>{const node=model.cloneNode(c.node);c.parent.children.push(node);return node.id;});s.layers.push({...M.clone(l),id:M.id('l'),name:l.name+' cópia',nodes:copies});});render();}catch(e){message(e.message,true);}};row.append(duplicate);
   const remove=R.el('button','','Remover camada');remove.onclick=()=>transact(()=>s.layers=s.layers.filter(x=>x!==l));row.append(remove);host.append(row);
  }
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
  else control=R.el(typeof value==='object'||typeof value==='string'&&value.length>80?'textarea':'input');
  if(!options&&control.tagName==='INPUT')control.type=typeof value==='boolean'?'checkbox':typeof value==='number'?'number':/^#[\da-f]{6}$/i.test(value)?'color':'text';
  if(['width','height'].includes(label)){const modeControl=R.el('select');modeControl.setAttribute('aria-label','Modo '+label);for(const mode of ['fixed','wrap','fill']){const option=R.el('option','',mode);option.value=mode;modeControl.append(option);}modeControl.value=typeof value==='number'?'fixed':value;modeControl.onchange=()=>transact(()=>update(modeControl.value==='fixed'?100:modeControl.value));wrap.append(modeControl);}
  control.dataset.property=label;if(typeof value==='boolean')control.checked=value;else control.value=typeof value==='object'?JSON.stringify(value):value;
  control.onchange=()=>{try{transact(()=>update(typeof value==='object'?JSON.parse(control.value):typeof value==='boolean'?control.checked:typeof value==='number'?Number(control.value):control.value));}catch(e){message(e.message,true);render();}};wrap.append(control);host.append(wrap);return control;
 }
 function renderInspector(){
  const host=$('ad-inspector');host.replaceChildren();
  field(host,'Namespace',model.value.namespace,v=>model.value.namespace=v);
  field(host,'Aplicativo',model.value.app_name,v=>model.value.app_name=v);
  const s=screen();if(!s){host.append(R.el('p','','No screens found. Start building your first screen.'));return;}field(host,'Screen',s.name,v=>s.name=v);
  field(host,'Largura da Screen',s.width,v=>s.width=v);field(host,'Altura da Screen',s.height,v=>s.height=v);
  const initial=R.el('button','','Usar como Screen inicial');initial.onclick=()=>transact(d=>model.value.start_screen=s.id);host.append(initial);
  field(host,'Cor primária',model.value.theme.primary,v=>model.value.theme.primary=v);
  field(host,'Modo de tema',model.value.theme.darkMode,v=>model.value.theme.darkMode=v,['system','light','dark']);
  field(host,'Dynamic Color',model.value.theme.dynamicColor,v=>model.value.theme.dynamicColor=v);
  const current=chosen()[0];if(!current){host.append(R.el('p','','Selecione um componente ou filho para editar.'));return;}
  const n=current.node;host.append(R.el('h4','',n.type+' · '+n.id.slice(0,12)));
  field(host,'Nome',n.name,v=>n.name=v);
  if(['Column','Row','Box','Grid','Region'].includes(n.type)){const convert=R.el('button','','Converter em Constraints');convert.id='ad-convert-constraints';convert.onclick=()=>{const parent=root.querySelector(`#ad-frames [data-node-id="${n.id}"]`),rects={};for(const e of parent?.children||[])if(e.dataset.nodeId)rects[e.dataset.nodeId]={x:e.offsetLeft,y:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight};try{model.convertConstraint(n.id,rects);render();}catch(e){message(e.message,true);}};host.append(convert);}
  field(host,'Papel',n.role,v=>n.role=v,['','title','subtitle','navigation','action','header','label','description','icon','leading','trailing','item','content']);
  const enums={orientation:['horizontal','vertical'],direction:['start','end','top','bottom'],kind:n.type==='Chart'?['line','bar','column','area','pie','donut','scatter','progress','gauge','sparkline','kpi']:['rect','roundedRect','ellipse','line','arrow','triangle','polygon','star','path','pencil','text'],variant:['filled','outlined','text','tonal','elevated'],keyboard:['text','email','number','password','phone'],overflow:['clip','ellipsis'],align:['start','center','end'],icon:['none','menu','back','home','search','close','settings','plus']};
  for(const [key,value] of Object.entries(n.props)){
   if(key==='source'){
    const input=R.el('input');input.type='file';input.accept='image/png';input.setAttribute('aria-label','Imagem PNG local');input.onchange=async()=>{const file=input.files[0];if(!file)return;if(file.size>2_000_000){message('Imagem deve ter até 2 MB.',true);return;}const reader=new FileReader();reader.onload=()=>transact(()=>n.props.source=reader.result);reader.readAsDataURL(file);};host.append(input);
   }else field(host,key,value,v=>n.props[key]=v,enums[key]);
  }
  const scope=R.el('select');scope.setAttribute('aria-label','Variação responsiva');
  for(const v of ['base','compact','medium','expanded','landscape']){const option=R.el('option','',v==='base'?'Base (todos os dispositivos)':v);option.value=v;scope.append(option);}scope.value=responsiveScope;scope.onchange=()=>{responsiveScope=scope.value;renderInspector();};host.append(scope);
  const supported=['width','height','minWidth','maxWidth','minHeight','maxHeight','padding','gap','weight','columns','alignment','arrangement','visible','wrap'];
  const currentLayout=responsiveScope==='base'?n.layout:{...n.layout,...n.layout.responsive[responsiveScope]};
  for(const [key,value] of Object.entries(currentLayout)){
   if(['responsive','constraints'].includes(key)||responsiveScope!=='base'&&!supported.includes(key))continue;
   const options={mode:n.type==='ConstraintLayout'?['constraint']:['auto','free'],anchorX:['start','center','end','fill'],anchorY:['top','center','bottom','fill'],alignment:['start','center','end'],arrangement:['start','center','end','spaceBetween'],scroll:['none','vertical','horizontal']}[key];
   field(host,key,value,v=>{
    const target=responsiveScope==='base'?n.layout:(n.layout.responsive[responsiveScope]??={});
    if(key==='mode'&&v==='free'&&n.type!=='Box')throw Error('Posicionamento livre requer Box.');
    if(key==='weight'&&Number(v)&&(!current.parent||!['Row','Column'].includes(current.parent.type)||current.parent.layout.scroll!=='none'))throw Error('Peso inválido para '+n.name+' ('+n.id+'). Use Row/Column sem scroll.');
    target[key]=['width','height'].includes(key)&&!['fill','wrap'].includes(v)?Number(v):v;
    const combined={...n.layout,...target};if(combined.minWidth>combined.maxWidth||combined.minHeight>combined.maxHeight)throw Error('Limites mínimos e máximos conflitantes.');for(const axis of ['width','height']){const title=axis[0].toUpperCase()+axis.slice(1);if(typeof combined[axis]==='number'&&(combined[axis]<combined['min'+title]||combined[axis]>combined['max'+title]))throw Error('Tamanho fixo incompatível com os limites.');}
   },options);
  }
  if(responsiveScope!=='base'){const reset=R.el('button','','Remover override desta classe');reset.onclick=()=>transact(()=>delete n.layout.responsive[responsiveScope]);host.append(reset);}
  groupInspector(host,n);renderConstraints(host,current);navigationEditor?.inspector(host,n);graphicsEditor?.inspector(host,n);
 }
 function groupInspector(host,node){
  const groups={};const section=name=>{if(groups[name])return groups[name];const details=R.el('details','ad-inspector-section');details.open=true;details.append(R.el('summary','',name));groups[name]=details;host.append(details);return details;};
  const children=[...host.children];for(const child of children){const key=child.querySelector('[data-property]')?.dataset.property;
   let name=['minWidth','maxWidth','minHeight','maxHeight','aspectRatio','weight','visible'].includes(key)?'Responsividade':Object.hasOwn(node.layout,key||'')?'Layout':['fontSize','bold','align','maxLines','overflow'].includes(key)?'Tipografia':['color','background','radius','elevation','variant'].includes(key)?'Aparência':child===host.querySelector('[aria-label="Destino da navegação"]')?'Eventos':'Conteúdo';
   if(child.getAttribute('aria-label')==='Variação responsiva')name='Responsividade';section(name).append(child);
  }
  if(model.locked(node.id)){for(const input of host.querySelectorAll('input,select,textarea')){if(!['locked','visible'].includes(input.dataset.property))input.disabled=true;}}
 }
 function setZoom(value,clientX,clientY){
  const host=$('ad-workspace'),rect=host.getBoundingClientRect(),old=zoom;
  const x=clientX===undefined?host.clientWidth/2:clientX-rect.left,y=clientY===undefined?host.clientHeight/2:clientY-rect.top;
  const px=(host.scrollLeft+x)/old,py=(host.scrollTop+y)/old;zoom=Math.max(.15,Math.min(2.5,value));renderWorkspace();host.scrollLeft=px*zoom-x;host.scrollTop=py*zoom-y;
 }
 function fit(){const host=$('ad-workspace'),screens=model.value.screens;if(!screens.length){setZoom(.8);return;}const maxX=Math.max(...screens.map(s=>s.position.x+s.width))+80,maxY=Math.max(...screens.map(s=>s.position.y+s.height))+80;setZoom(Math.min(host.clientWidth/maxX,host.clientHeight/maxY));host.scrollTo(0,0);}
 function removeSelected(){
  try{model.deleteNodes([...selected]);selected.clear();render();}catch(e){message(e.message,true);}
 }
 async function save(){
  if(saving)return;saving=true;$('ad-save').disabled=true;
  try{
   model.value.editor_preferences={...panelPrefs};
   model.value.viewport={zoom,x:$('ad-workspace').scrollLeft,y:$('ad-workspace').scrollTop};
   const snapshot=M.clone(model.value),result=await api.save_interface(root.dataset.projectId,snapshot,revision);
   if(disposed)return;revision=result.revision;model.saved=JSON.stringify(snapshot);dirty();message('Interface salva no computador.');
  }catch(e){message(e.message,true);throw e;}finally{saving=false;if(!disposed)$('ad-save').disabled=false;}
 }
 function runPreviewAction(e){
  previewErrors={};for(const rule of e.validation||[]){const value=String(previewState[rule.field]??model.find(rule.field)?.node.props.value??'');if(rule.type==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))previewErrors[rule.field]='Informe um e-mail válido.';if(rule.type==='password'&&value.length<6)previewErrors[rule.field]='Use pelo menos 6 caracteres.';if(rule.type==='required'&&!value.trim())previewErrors[rule.field]='Campo obrigatório.';}if(Object.keys(previewErrors).length){renderPreview();return;}
  if(e.broken){message('Destino excluído. Corrija o evento no Inspector.',true);return;}
  if(e.action==='back'){if(previewStack.length>1)previewStack.pop();}
  else if(e.action==='navigate'&&model.value.screens.some(s=>s.id===e.target)){
   if(e.policy==='replace')previewStack.pop();
   if(e.policy==='popUpTo'&&previewStack.includes(e.popUpTo))previewStack=previewStack.slice(0,previewStack.indexOf(e.popUpTo)+1);
   if(previewStack.at(-1)!==e.target)previewStack.push(e.target);
  }else if(e.action==='url'){message('URL: '+e.target+' (abra no navegador externo pelo aplicativo exportado).');return;}
  else if(e.action==='custom'){message('Ação nomeada: '+e.target+' — nenhum código executado.');return;}
  renderPreview();
 }
 function renderPreview(){
  const active=model.value.screens.find(s=>s.id===previewStack.at(-1))||model.value.screens.find(s=>s.id===model.value.start_screen);if(!active){$('ad-preview-screen').replaceChildren(R.el('p','','Crie sua primeira Screen.'));return;}
  $('ad-preview-name').value=active.name;$('ad-preview-screen').style.width='100%';$('ad-preview-screen').style.minHeight=previewHeight+'px';$('ad-preview-screen').style.height=previewHeight+'px';$('ad-preview-viewport').style.width=previewWidth+'px';$('ad-preview-viewport').style.height=previewHeight+'px';
  $('ad-preview-screen').replaceChildren(R.render(AgataConstraints.layered(active).root,{preview:true,width:previewWidth,height:previewHeight,fontScale,state:previewState,validationErrors:previewErrors,activeScreen:active.id,action:runPreviewAction}));
  requestAnimationFrame(()=>{if(disposed)return;const diagnostics=window.AgataLayout.measure($('ad-preview-screen'));$('ad-layout-diagnostics').replaceChildren(...diagnostics.warnings.map(w=>R.el('li','',w.message)));$('ad-status').textContent=window.AgataLayout.sizeClass(previewWidth)+' · '+diagnostics.warnings.length+' aviso(s) de layout';});
 }
 function ensureEditor(){if(codeEditor)return;codeEditor=window.AgataCodeEditor.create($('ad-code-editor'),(text)=>{
  if(codeUpdating)return;
  if($('ad-backend').value==='model'){ if(modelDraft===null)modelDraftBase=JSON.stringify(model.value);modelDraft=text;$('ad-code-note').textContent='JSON modificado. Aplicar JSON ao Design valida o schema antes de alterar a interface.'; }
  else if(customMode&&filePath){model.transact(d=>d.custom_files[$('ad-backend').value+'/'+filePath]=text);dirty();}
 });}
 function showFile(){
  ensureEditor();filePath=$('ad-file').value;customMode=!!model.value.custom_files[$('ad-backend').value+'/'+filePath];
  codeWorkflow?.track();const isModel=$('ad-backend').value==='model';codeUpdating=true;codeEditor.setValue(isModel?(modelDraft??JSON.stringify(model.value,null,2)):(model.value.custom_files[$('ad-backend').value+'/'+filePath]??files[filePath]??''),isModel?'json':filePath.endsWith('.xml')?'xml':filePath.endsWith('.kt')||filePath.endsWith('.kts')?'kotlin':'text',isModel||customMode,$('ad-backend').value+'/'+filePath);codeUpdating=false;
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
  $('ad-palette').hidden=!['design','split'].includes(mode);
  $('ad-workspace').hidden=!['design','split'].includes(mode);$('ad-workspace-tools').hidden=!['design','split'].includes(mode);$('ad-code').hidden=!['code','split'].includes(mode);$('ad-preview').hidden=mode!=='preview';
  if(mode==='preview'){previewStack=[model.value.start_screen];previewState={};renderPreview();}
  constraintEditor?.redraw();if(['code','split'].includes(mode))await generate();
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
  const n=M.node(registry,$('ad-component-kind').value);if(n.type==='Barrier')n.props.references=parent.children.filter(c=>!['Guideline','Barrier'].includes(c.type)).map(c=>c.id).join(' ');try{model.insertNode(parent.id,n);selectNode(n.id);}catch(e){message(e.message,true);}
 });
 on($('ad-copy'),'click',()=>{clipboard=chosen().filter(c=>c.parent).map(c=>M.clone(c.node));message('Componentes copiados. Selecione outra Screen para colar.');});
 on($('ad-paste'),'click',()=>{try{model.insertNodes(screen().root.id,clipboard.map(n=>model.cloneNode(n)));render();}catch(e){message(e.message,true);}});
 on($('ad-duplicate'),'click',()=>{transact(()=>{for(const c of chosen().filter(c=>c.parent))c.parent.children.splice(c.parent.children.indexOf(c.node)+1,0,model.cloneNode(c.node));});});
 on($('ad-delete'),'click',removeSelected);
 for(const [id,step] of [['ad-up',-1],['ad-down',1]])on($(id),'click',()=>{
  const sources=model.topNodes([...selected]);if(!sources.length)return;const c=sources[0];
  try{if(!c.parent||sources.some(s=>s.parent!==c.parent))throw Error('Selecione irmãos do mesmo contêiner.');const index=c.parent.children.indexOf(c.node);model.moveNodes(sources.map(s=>s.node.id),c.parent.id,index+(step>0?sources.length+1:-1));render();}catch(e){message(e.message,true);}
 });
 on($('ad-undo'),'click',()=>{model.undo();render();});on($('ad-redo'),'click',()=>{model.redo();render();});
 for(const b of root.querySelectorAll('[data-mode]'))on(b,'click',()=>setMode(b.dataset.mode));
 on($('ad-zoom-in'),'click',()=>setZoom(zoom*1.2));on($('ad-zoom-out'),'click',()=>setZoom(zoom/1.2));on($('ad-fit'),'click',fit);on($('ad-reset'),'click',()=>{zoom=.8;renderWorkspace();$('ad-workspace').scrollTo(0,0);});
 on($('ad-grid'),'click',()=>{$('ad-workspace').classList.toggle('ad-no-grid');$('ad-grid').setAttribute('aria-pressed',String(!$('ad-workspace').classList.contains('ad-no-grid')));});
 on($('ad-connections'),'click',()=>{showLinks=!showLinks;$('ad-connections').setAttribute('aria-pressed',String(showLinks));renderWorkspace();});
 on($('ad-workspace'),'wheel',event=>{if(event.ctrlKey||event.metaKey){event.preventDefault();setZoom(zoom*Math.exp(-event.deltaY*.002),event.clientX,event.clientY);}});
 on($('ad-workspace'),'pointerdown',event=>{if(event.button!==1)return;event.preventDefault();const h=$('ad-workspace'),x=event.clientX,y=event.clientY,left=h.scrollLeft,top=h.scrollTop;h.setPointerCapture(event.pointerId);const move=e=>{h.scrollLeft=left+x-e.clientX;h.scrollTop=top+y-e.clientY;};const stop=()=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',stop);};h.addEventListener('pointermove',move);h.addEventListener('pointerup',stop);});
 on($('ad-connect'),'pointerdown',event=>{
  const source=chosen()[0];if(!source){message('Selecione primeiro o componente de origem.',true);return;}event.preventDefault();
  const finish=e=>{document.removeEventListener('pointerup',finish);const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-frame-id]');if(target){model.updateEvent(source.node.id,{action:'navigate',target:target.dataset.frameId});render();message('Conexão de navegação criada.');}else message('Solte sobre a Screen de destino.',true);};document.addEventListener('pointerup',finish,{once:true,signal:abort.signal});
 });
 on($('ad-preview-back'),'click',()=>{if(previewStack.length>1)previewStack.pop();renderPreview();});on($('ad-preview-reset'),'click',()=>{previewStack=[model.value.start_screen];previewState={};renderPreview();});
 on($('ad-generate'),'click',generate);on($('ad-backend'),'change',generate);on($('ad-file'),'change',showFile);
 on($('ad-customize'),'click',()=>{
  if($('ad-backend').value==='model')return;
  if(!/^app\/src\/main\/(java\/[a-zA-Z0-9_/]+\.kt|res\/(layout|values)\/[a-z0-9_]+\.xml)$/.test(filePath)){message('Somente arquivos Kotlin e XML de aplicação podem ser personalizados.',true);return;}
  model.transact(d=>d.custom_files[$('ad-backend').value+'/'+filePath]=files[filePath]);showFile();dirty();
 });
 on($('ad-apply-model'),'click',async()=>{
  if($('ad-backend').value!=='model')return;try{if(modelDraft!==null&&modelDraftBase!==JSON.stringify(model.value))throw Error('O Design mudou desde o início deste rascunho. Preserve seu JSON e descarte o rascunho antes de tentar novamente.');const value=JSON.parse(codeEditor.getValue());const clean=await api.validate_interface(value);modelDraft=null;transact(()=>model.value=clean.document);$('ad-code-error').textContent='';}catch(e){$('ad-code-error').textContent=e.message;}
 });
 on($('ad-discard-json'),'click',()=>{modelDraft=null;showFile();});
 on($('ad-format-json'),'click',()=>{try{codeEditor.setValue(JSON.stringify(JSON.parse(codeEditor.getValue()),null,2),'json',true);}catch(e){$('ad-code-error').textContent=e.message;}});
 for(const backend of ['xml','compose'])on($('ad-export-'+backend),'click',async()=>{try{await save();const result=await api.export_android(root.dataset.projectId,backend);document.dispatchEvent(new CustomEvent('agata:exported',{detail:backend}));if(!disposed)message('Exportado: '+result.path+(result.warnings?.length?' · '+result.warnings.length+' aviso(s); veja agata-export-diagnostics.json':''));}catch(e){if(!disposed)message(e.message,true);}});
 on($('ad-example'),'click',()=>{
  const first=screen(),second=model.addScreen();second.name='Dashboard';second.root.children=[M.node(registry,'TextLabel',{text:'Dashboard',fontSize:24,bold:true})];
  const top=M.node(registry,'TopBar'),card=M.node(registry,'Card'),field=M.node(registry,'TextField'),button=M.node(registry,'Button'),bottom=M.node(registry,'BottomBar');
  button.children.find(c=>c.type==='TextLabel').props.text='Entrar';button.events.onClick={action:'navigate',target:second.id};
  bottom.children[1].children.find(c=>c.type==='TextLabel').props.text='Dashboard';bottom.children[1].events.onClick={action:'navigate',target:second.id};
  transact(()=>first.root.children.push(top,card,field,button,bottom));screenId=first.id;selected=new Set([button.id]);render();fit();
 });
 on(document,'keydown',event=>{
  if(!root.isConnected||event.defaultPrevented||event.target.closest?.('input,textarea,.cm-editor,select'))return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save().catch(()=>{});}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopPropagation();if(event.repeat)return;if(event.shiftKey)model.redo();else model.undo();render();}
  if(event.key==='Delete'&&mode==='design'){event.preventDefault();removeSelected();}
 });
 for(const kind of Object.keys(registry)){const b=R.el('button','ad-palette-item',kind);b.dataset.paletteKind=kind;b.title='Arraste para a Screen';$('ad-palette').append(b);}
 dragController=window.AgataDragDrop.mount(root,{model,selection:()=>selected,registry,commit:render,notify:message,isDesign:()=>['design','split'].includes(mode)});
 on($('ad-group'),'click',()=>{try{const group=model.groupNodes([...selected]);selectNode(group.id);}catch(e){message(e.message,true);}});
 on($('ad-ungroup'),'click',()=>{const c=chosen()[0];if(!c?.parent||!['Column','Row','Box','Grid'].includes(c.node.type)){message('Selecione um grupo de layout.',true);return;}try{model.ungroupNode(c.node.id);selected.clear();render();}catch(e){message(e.message,true);}});
 on($('ad-preview-preset'),'change',()=>{const value=$('ad-preview-preset').value;if(value==='custom')return;[previewWidth,previewHeight]=value.split(',').map(Number);$('ad-preview-width').value=previewWidth;$('ad-preview-height').value=previewHeight;renderPreview();});
 on($('ad-preview-rotate'),'click',()=>{[previewWidth,previewHeight]=[previewHeight,previewWidth];$('ad-preview-width').value=previewWidth;$('ad-preview-height').value=previewHeight;renderPreview();});
 for(const axis of ['width','height'])on($('ad-preview-'+axis),'change',()=>{const value=Number($('ad-preview-'+axis).value);if(value<240||value>4096){message('Use dimensão entre 240 e 4096.',true);return;}if(axis==='width')previewWidth=value;else previewHeight=value;renderPreview();});
 on($('ad-font-scale'),'change',()=>{fontScale=Number($('ad-font-scale').value);renderPreview();});
 let resizing=false;
 previewObserver=new ResizeObserver(entries=>{if(mode!=='preview'||resizing)return;const r=entries[0].target.getBoundingClientRect();if(Math.abs(r.width-previewWidth)>1||Math.abs(r.height-previewHeight)>1){resizing=true;previewWidth=Math.round(r.width);previewHeight=Math.round(r.height);$('ad-preview-width').value=previewWidth;$('ad-preview-height').value=previewHeight;renderPreview();resizing=false;}});previewObserver.observe($('ad-preview-viewport'));
 const preferences=()=>{try{return JSON.parse(localStorage.getItem('agata-editor-panels')||'{}');}catch{return {};}};
 const panelPrefs={...preferences(),...model.value.editor_preferences};
 for(const [id,cls] of [['ad-toggle-library','ad-library'],['ad-toggle-inspector','ad-inspector']]){
  const panel=root.querySelector('.'+cls);if(panelPrefs[cls])panel.hidden=true;if(panelPrefs[cls+'Width'])panel.style.width=panelPrefs[cls+'Width']+'px';
  const observer=new ResizeObserver(()=>{if(!panel.hidden){panelPrefs[cls+'Width']=Math.round(panel.getBoundingClientRect().width);localStorage.setItem('agata-editor-panels',JSON.stringify(panelPrefs));}});observer.observe(panel);panelObservers.push(observer);
  on($(id),'click',()=>{panel.hidden=!panel.hidden;$(id).setAttribute('aria-expanded',String(!panel.hidden));panelPrefs[cls]=panel.hidden;localStorage.setItem('agata-editor-panels',JSON.stringify(panelPrefs));});
 }
 on(document,'keydown',event=>{
  if(event.target.closest?.('input,select,textarea,.cm-editor')||mode!=='design')return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='g'){event.preventDefault();$('ad-group').click();}
  if(event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();$('ad-'+(event.key==='ArrowUp'?'up':'down')).click();}
  if((event.ctrlKey||event.metaKey)&&['c','v','d'].includes(event.key.toLowerCase())){event.preventDefault();$('ad-'+{c:'copy',v:'paste',d:'duplicate'}[event.key.toLowerCase()]).click();}
 });
 explorer=window.AgataProjectExplorer.mount(root,{model,select:selectNode,render,save,notify:message,replace:async doc=>{const clean=await api.validate_interface({...doc,custom_files:model.value.custom_files});model.transact(()=>model.value=clean.document);screenId=model.value.start_screen;selected.clear();render();}});
 graphicsEditor=window.AgataGraphicsEditor.mount(root,{model,registry,selection:()=>selected,screen,select:selectNode,render,notify:message});
 desktop=window.AgataDesktop.mount(root,{registry,redraw:()=>{constraintEditor?.redraw();navigationEditor?.redraw();}});codeWorkflow=window.AgataCodeWorkflow.mount(root,{model,generate,refresh:()=>{generate();dirty();},getFile:()=>({backend:$('ad-backend').value,path:filePath})});
 navigationEditor=window.AgataNavigationEditor.mount(root,{model,selection:()=>selected,select:selectNode,render,notify:message,preview:async id=>{const c=model.find(id);await setMode('preview');previewStack=[c.screen.id];runPreviewAction(c.node.events.onClick||{});}});on($('ad-flow'),'click',()=>navigationEditor.flow());
 constraintEditor=window.AgataConstraintEditor.mount(root,{model,selection:()=>selected,commit:()=>{document.dispatchEvent(new CustomEvent('agata:action',{detail:'constraint'}));render();},notify:message,enabled:()=>constraintMode&&['design','split'].includes(mode)});
 on($('ad-constraint-mode'),'click',()=>{constraintMode=!constraintMode;root.dataset.constraintMode=String(constraintMode);navigationEditor?.redraw();if(constraintMode){const c=chosen()[0];if(c?.parent?.type!=='ConstraintLayout')message('Selecione um filho de ConstraintLayout, ou use Converter em Constraints no Inspector.');}$('ad-constraint-mode').setAttribute('aria-pressed',String(constraintMode));constraintEditor.redraw();});
 on($('ad-center-node'),'click',()=>{try{model.centerNode([...selected][0]);document.dispatchEvent(new CustomEvent('agata:action',{detail:'center'}));render();}catch(e){message(e.message,true);}});
 on($('ad-new-layer'),'click',()=>{try{model.addLayer(screen(),[...selected]);render();}catch(e){message(e.message,true);}});
 on($('ad-add-region'),'click',()=>{try{const current=chosen()[0],parent=current&&registry[current.node.type]?.container?current.node:current?.parent||screen().root;const region=M.node(registry,'Region');region.name='Região';region.layout.width=160;region.layout.height=200;model.insertNode(parent.id,region);selected=new Set([region.id]);render();}catch(e){message(e.message,true);}});
 on(root,'agata:constraint-drop',event=>{
  root.querySelector('.ad-placement-choice')?.remove();const {ids,position}=event.detail;if(!position)return;
  const card=R.el('section','ad-tour-card ad-placement-choice');card.setAttribute('role','dialog');card.setAttribute('aria-label','Posicionamento do componente');card.append(R.el('h3','','Como posicionar?'),R.el('p','','As restrições existentes foram preservadas. Escolha uma regra explícita para esta posição.'));
  const action=(label,fn)=>{const b=R.el('button','',label);b.onclick=()=>{try{fn();card.remove();render();}catch(e){message(e.message,true);}};card.append(b);};
  action('Fixar ao pai / criar constraints',()=>model.transact(()=>{for(const id of ids){const c=model.find(id);if(!c||model.locked(id))continue;c.node.layout.constraints={start:{target:'parent',anchor:'start',margin:position.x},top:{target:'parent',anchor:'top',margin:position.y}};}}));
  action('Centralizar',()=>{for(const id of ids)model.centerNode(id);});
  action('Manter posicionamento livre',()=>model.transact(()=>{for(const id of ids){const n=model.find(id)?.node;if(n){n.layout.constraints={};n.layout.x=position.x;n.layout.y=position.y;}}}));
  action('Editar manualmente',()=>{selected=new Set(ids);});action('Fechar',()=>{});root.append(card);
 });
 tour=window.AgataTutorial.mount(root,{model,render,setMode,notify:message});on($('ad-help'),'click',()=>tour.offer(true));
 window.VelaPage={...(window.VelaPage||{}),beforeUnmount(){disposed=true;clearTimeout(generationTimer);abort.abort();notifications.dispose();codeEditor?.destroy();dragController?.dispose();constraintEditor?.dispose();navigationEditor?.dispose();desktop?.dispose();graphicsEditor?.dispose();explorer?.dispose();tour?.dispose();previewObserver?.disconnect();panelObservers.forEach(o=>o.disconnect());}};
 render();await setMode('design');tour.maybeOffer();
 if(model.value.viewport){$('ad-workspace').scrollTo(model.value.viewport.x,model.value.viewport.y);}else fit();
}};
