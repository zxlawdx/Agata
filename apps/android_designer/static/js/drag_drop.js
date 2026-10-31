/* Pointer sensor, collision/insertion feedback, one semantic transaction per drop.
   No dependency on HTML5 DragEvent, React or a remote runtime. */
window.AgataDragDrop={mount(root,{model,selection,registry,commit,notify,isDesign}){
 const abort=new AbortController();let session=null,suppressClick=false;
 const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:abort.signal});
 const el=(cls)=>{const e=document.createElement('div');e.className=cls;e.style.pointerEvents='none';root.append(e);return e;};
 const ghost=el('ad-drag-ghost'),marker=el('ad-drop-marker');ghost.hidden=marker.hidden=true;
 function clear(){root.querySelectorAll('.ad-drop-target').forEach(e=>e.classList.remove('ad-drop-target'));marker.hidden=true;}
 function targetAt(x,y){
  const hit=document.elementFromPoint(x,y);if(!hit||!root.contains(hit))return null;
  const row=hit.closest('[data-tree-node]'),view=hit.closest('[data-node-id]');
  let id=row?.dataset.treeNode||view?.dataset.nodeId;
  if(!id){const frame=hit.closest('[data-frame-id]');id=model.value.screens.find(s=>s.id===frame?.dataset.frameId)?.root.id;}
  if(!id)return null;const found=model.find(id);if(!found)return null;
  let parent=found.node,element=row||view||root.querySelector(`[data-node-id="${id}"]`),index=parent.children.length;
  const box=element.getBoundingClientRect(),edge=row?Math.min(8,box.height/4):Math.min(9,box.height/5),horizontal=found.parent?.type==='Row';
  const coord=horizontal?x:y,low=horizontal?box.left:box.top,high=horizontal?box.right:box.bottom;
  if(found.parent&&(coord<low+edge||coord>high-edge||!registry[parent.type]?.container||!model.accepts(parent,session.kind?{type:session.kind}:model.find(session.ids[0])?.node||{}))){
   const after=coord>(low+high)/2;parent=found.parent;index=parent.children.indexOf(found.node)+(after?1:0);
   return {parent,index,element,edge:after?'after':'before',horizontal,box};
  }
  if(!row){
   const children=[...element.children].filter(e=>e.dataset.nodeId),axis=parent.type==='Row'?'x':'y';
   index=children.findIndex(e=>{const r=e.getBoundingClientRect();return axis==='x'?x<r.left+r.width/2:y<r.top+r.height/2;});if(index<0)index=parent.children.length;
  }
  const scale=box.width/(element.offsetWidth||box.width),child=session?.ids?.length?model.find(session.ids[0])?.node:null;
  const width=session.sourceSize?.width||120,height=session.sourceSize?.height||48;
  const position={x:Math.max(0,Math.min(element.clientWidth-width,Math.round((x-box.left)/scale/8)*8)),y:Math.max(0,Math.min(element.clientHeight-height,Math.round((y-box.top)/scale/8)*8))};
  return {parent,index,element,box,position:{...(row?{x:0,y:0}:position),width:Math.min(width,element.clientWidth),height:Math.min(height,element.clientHeight)}};
 }
 function valid(target){if(!target)return false;const nodes=session.kind?[{type:session.kind}]:model.topNodes(session.ids).map(c=>c.node);
  return nodes.length>0&&nodes.every(n=>model.accepts(target.parent,n)&&(!n.id||(!model.contains(n.id,target.parent.id)&&!model.locked(n.id)&&model.find(n.id)?.parent)));
 }
 on(root,'pointerdown',event=>{
  if(event.button!==0||!isDesign()||event.target.closest?.('input,textarea,select,.ad-frame-title,.ad-constraint-anchor,.ad-constraint-lines'))return;
  const palette=event.target.closest?.('[data-palette-kind]'),resize=event.target.closest?.('[data-resize-node]'),handle=event.target.closest?.('[data-drag-node]'),node=event.target.closest?.('[data-node-id]');
  const id=resize?.dataset.resizeNode||handle?.dataset.dragNode||node?.dataset.nodeId;
  if(!palette&&!id)return;if(id&&model.locked(id)){notify('Componente bloqueado.',true);return;}
  const ids=id&&selection().has(id)?[...selection()]:id?[id]:[];
  const source=id?model.find(id):null;if(source&&!source.parent&&!resize)return;
  const sourceElement=root.querySelector(`[data-node-id="${id}"]`);const rect=sourceElement?.getBoundingClientRect()||node?.getBoundingClientRect();
  session={startX:event.clientX,startY:event.clientY,ids,kind:palette?.dataset.paletteKind,resize:resize?.dataset.resizeNode,rect,sourceSize:sourceElement?{width:sourceElement.offsetWidth,height:sourceElement.offsetHeight}:null,active:false};
  if(palette||resize)event.preventDefault();
 });
 on(root,'pointermove',event=>{
  if(!session)return;const distance=Math.hypot(event.clientX-session.startX,event.clientY-session.startY);if(!session.active&&distance<5)return;
  if(!session.active)root.setPointerCapture(event.pointerId);session.active=true;event.preventDefault();ghost.hidden=false;ghost.textContent=session.resize?'Redimensionar':session.kind||`${session.ids.length} componente(s)`;ghost.style.left=event.clientX+12+'px';ghost.style.top=event.clientY+12+'px';clear();
  if(session.resize){const element=root.querySelector(`[data-node-id="${session.resize}"]`),scale=session.rect.width/element.offsetWidth;session.size={width:Math.max(8,Math.min(4096,Math.round((session.rect.width+event.clientX-session.startX)/scale/8)*8)),height:Math.max(8,Math.min(4096,Math.round((session.rect.height+event.clientY-session.startY)/scale/8)*8))};ghost.textContent=session.size.width+' × '+session.size.height;return;}
  session.target=targetAt(event.clientX,event.clientY);const ok=valid(session.target);ghost.dataset.valid=String(ok);root.style.cursor=ok?'grabbing':'not-allowed';
  if(!ok)return;const t=session.target;t.element.classList.add('ad-drop-target');
  if(t.edge){marker.hidden=false;Object.assign(marker.style,{left:(t.horizontal?(t.edge==='after'?t.box.right:t.box.left):t.box.left)+'px',top:(t.horizontal?t.box.top:t.edge==='after'?t.box.bottom:t.box.top)+'px',width:(t.horizontal?3:t.box.width)+'px',height:(t.horizontal?t.box.height:3)+'px'});}
  else if(t.parent.type==='Box'&&t.parent.layout.mode==='free'){marker.hidden=false;const scale=t.box.width/t.element.offsetWidth;Object.assign(marker.style,{left:t.box.left+t.position.x*scale+'px',top:t.box.top+t.position.y*scale+'px',width:'48px',height:'32px'});}
 });
 function finish(event,cancelled=false){
  const current=session;if(!current)return;session=null;ghost.hidden=true;root.style.cursor='';clear();
  if(!current.active||cancelled)return;suppressClick=true;setTimeout(()=>suppressClick=false,0);
  try{
   if(current.resize){model.resizeNode(current.resize,current.size.width,current.size.height);}
   else{
    session=current;const validDrop=valid(current.target);session=null;if(!validDrop)throw Error('Destino não aceita a operação.');
    const t=current.target;if(current.kind){const n=window.AgataUIModel.node(registry,current.kind);if(n.type==='Barrier')n.props.references=t.parent.children.filter(c=>!['Guideline','Barrier'].includes(c.type)).map(c=>c.id).join(' ');if(t.parent.type==='Box'&&t.parent.layout.mode==='free')Object.assign(n.layout,t.position,{width:120,height:48});model.insertNode(t.parent.id,n,t.index);}
    else model.moveNodes(current.ids,t.parent.id,t.index,t.position);
   }
   commit();if(!current.resize&&current.target?.parent.type==='ConstraintLayout')root.dispatchEvent(new CustomEvent('agata:constraint-drop',{detail:{parent:current.target.parent.id,ids:current.kind?current.target.parent.children.slice(current.target.index,current.target.index+1).map(n=>n.id):current.ids,position:current.target.position}}));
  }catch(error){session=null;notify(error.message,true);}
 }
 on(root,'pointerup',event=>finish(event));on(root,'pointercancel',event=>finish(event,true));
 on(document,'keydown',event=>{if(event.key==='Escape')finish(event,true);});
 on(root,'click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
 return {dispose(){abort.abort();ghost.remove();marker.remove();session=null;clear();}};
}};
