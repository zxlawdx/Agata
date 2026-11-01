/* Agata canvas controls. Editor-only navigation never writes the project.
 * Pointer input is registered in the GrapesJS iframe and the canvas host, not
 * the entire pywebview. Frame/document listeners are replaced on navigation.
 */
(function (global) {
"use strict";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const editTarget=e=>e.target?.closest?.("input,textarea,select,[contenteditable=true],.monaco-editor");
class CanvasInteraction {
 constructor(root,adapter,{getDocument,getSelection,onSelect,onError,onZoom}){
  this.root=root;this.canvas=adapter;this.getDocument=getDocument;
  this.onSelect=onSelect;this.onError=onError;this.onZoom=onZoom;
  this.getSelection=getSelection||(()=>new Set());
  this.mode="responsive";this.space=false;this.active=null;this.grid=true;
  this.spacing=20;this.snap=true;this.rulers=false;this.guides=true;
  this.abort=new AbortController();this.frameAbort=null;
  this.host=root.querySelector("#ws-design");this.bindOuter();
  this.apply();
 }
 listen(target,event,handler,options={}){
  target?.addEventListener(event,handler,{...options,signal:this.abort.signal});
 }
 bindOuter(){
  const key=e=>{if(e.code!=="Space"||editTarget(e))return;
   if(e.type==="keydown"&&!e.repeat){this.space=true;this.cursor();}
   if(e.type==="keyup"){this.space=false;this.cursor();}
   e.preventDefault();};
  this.listen(global,"keydown",key,true);this.listen(global,"keyup",key,true);
  this.listen(global,"blur",()=>{this.space=false;this.cancel();this.cursor()});
  this.listen(this.host,"pointerdown",e=>this.start(e,false),{capture:true});
  this.listen(this.host,"pointermove",e=>this.move(e,false),{capture:true});
  this.listen(this.host,"pointerup",e=>this.end(e),{capture:true});
  this.listen(this.host,"pointercancel",e=>this.end(e),{capture:true});
  this.listen(this.host,"auxclick",e=>{if(e.button===1)e.preventDefault()},true);
  this.listen(this.host,"wheel",e=>this.wheel(e,false),{capture:true,passive:false});
 }
 bindFrame(){
  this.frameAbort?.abort();this.frameAbort=new AbortController();
  const frame=this.canvas.editor.Canvas.getFrameEl(),doc=frame?.contentDocument;
  if(!doc)return;
  const on=(event,fn,options={})=>doc.addEventListener(event,fn,{...options,signal:this.frameAbort.signal});
  on("pointerdown",e=>this.start(e,true),{capture:true});
  on("pointermove",e=>this.move(e,true),{capture:true});
  on("pointerup",e=>this.end(e),{capture:true});
  on("pointercancel",e=>this.end(e),{capture:true});
  on("auxclick",e=>{if(e.button===1)e.preventDefault()},{capture:true});
  on("contextmenu",e=>{if(this.active?.type==="pan")e.preventDefault()},{capture:true});
  on("wheel",e=>this.wheel(e,true),{capture:true,passive:false});
  on("keydown",e=>{
   if(e.code==="Space"&&!editTarget(e)){this.space=true;this.cursor();e.preventDefault();e.stopImmediatePropagation();}
  },{capture:true});
  on("keyup",e=>{if(e.code==="Space"){this.space=false;this.cursor();e.preventDefault();}},{capture:true});
  this.cursor();
 }
 coords(){const c=this.canvas.editor.Canvas;return typeof c.getCoords==="function"?c.getCoords():{x:this.host.scrollLeft,y:this.host.scrollTop};}
 setCoords(x,y){const c=this.canvas.editor.Canvas;
  if(typeof c.setCoords==="function")c.setCoords(x,y);
  else{this.host.scrollLeft=x;this.host.scrollTop=y;}}
 point(e,inside){
  if(!inside)return{x:e.clientX,y:e.clientY};
  const r=this.canvas.editor.Canvas.getFrameEl().getBoundingClientRect();
  return{x:r.x+e.clientX,y:r.y+e.clientY};
 }
 stop(e){if(e.cancelable)e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();}
 start(e,inside){
  if(this.active)return;
  const pan=e.button===1||(this.space&&e.button===0);
  const free=this.mode==="free"&&e.button===0&&!this.space;
  if(!pan&&!free)return;
  const p=this.point(e,inside);
  if(pan){
   this.active={type:"pan",id:e.pointerId,point:p,origin:{...this.coords()},moves:0,target:e.target};
   try{e.target.setPointerCapture?.(e.pointerId);}catch{}
   this.stop(e);this.cursor();return;
  }
  const element=e.target?.closest?.("[data-agata-id]");
  const id=element?.dataset.agataId;
  const doc=this.getDocument();
  if(!id||!doc?.nodes.has(id))return;
  const n=doc.node(id);
  if(!n.parent?.id)return; // free layout requires an explicit mapped container
  const parent=element.parentElement?.closest("[data-agata-id]");
  if(!parent||parent.dataset.agataId!==n.parent.id)return;
  const style=element.ownerDocument.defaultView.getComputedStyle(element);
  const parentStyle=element.ownerDocument.defaultView.getComputedStyle(parent);
  if(["flex","grid"].some(x=>parentStyle.display.includes(x))&&parentStyle.position==="static"){
    this.onError(Error("Posicionamento livre requer container de referência. Use 'Preparar contêiner' explicitamente; Flex/Grid não é convertido automaticamente."));
    return;
  }
  const ids=this.getSelection().has(id)?[...this.getSelection()]:[id];
  this.onSelect(id,ids.length>1);
  const parentRect=parent.getBoundingClientRect(),elRect=element.getBoundingClientRect();
  const zoom=Math.max(.05,this.canvas.editor.Canvas.getZoom()/100);
  const x=style.position==="absolute"?parseFloat(style.left)||0:(elRect.x-parentRect.x);
  const y=style.position==="absolute"?parseFloat(style.top)||0:(elRect.y-parentRect.y);
  try{e.target.setPointerCapture?.(e.pointerId);}catch{}
  const items=ids.map(nodeId=>{
    const dom=element.ownerDocument.querySelector('[data-agata-id="'+nodeId+'"]');
    const node=doc.nodes.get(nodeId);
    if(!dom||node?.parent?.id!==n.parent.id)return null;
    const box=dom.getBoundingClientRect(),css=dom.ownerDocument.defaultView.getComputedStyle(dom);
    return {id:nodeId,element:dom,start:{
      x:css.position==="absolute"?parseFloat(css.left)||0:(box.x-parentRect.x),
      y:css.position==="absolute"?parseFloat(css.top)||0:(box.y-parentRect.y)
    }};
  }).filter(Boolean);
  if(!items.length)return;
  this.active={type:"free",id:e.pointerId,point:p,start:{x,y},node:id,target:e.target,
    items,element,zoom,moved:false};
  this.stop(e);this.cursor();
 }
 move(e,inside){
  const a=this.active;if(!a||a.id!==e.pointerId)return;
  const p=this.point(e,inside),dx=p.x-a.point.x,dy=p.y-a.point.y;
  if(a.type==="pan"){this.setCoords(a.origin.x+dx,a.origin.y+dy);a.moves++;this.stop(e);}
  else{
   const x=a.start.x+dx/a.zoom,y=a.start.y+dy/a.zoom;
   const snap=v=>this.snap?Math.round(v/this.spacing)*this.spacing:Math.round(v);
   a.next={x:Math.max(0,snap(x)),y:Math.max(0,snap(y))};
   for(const item of a.items){
     const next={x:Math.max(0,snap(item.start.x+dx/a.zoom)),
                 y:Math.max(0,snap(item.start.y+dy/a.zoom))};
     item.next=next;item.element.style.position="absolute";
     item.element.style.left=next.x+"px";item.element.style.top=next.y+"px";
   }
   a.moved=true;
   this.stop(e);
  }
 }
 end(e){
  const a=this.active;if(!a||a.id!==e.pointerId)return;
  this.active=null;try{a.target?.releasePointerCapture?.(e.pointerId);}catch{}
  this.cursor();this.stop(e);
  if(a.type==="pan")return;
  if(!a.moved||!a.next)return;
  try{
   const doc=this.getDocument(),node=doc.node(a.node);
   if(!node.parent?.id)throw Error("Contêiner não mapeado");
   const parent=this.canvas.computed(node.parent.id);
   if(parent?.position==="static")throw Error("Prepare primeiro o contêiner para posicionamento livre.");
   doc.transaction(a.items.length>1?"Mover seleção livre":"Mover elemento livre",()=>{
    for(const item of a.items){
      doc.style(item.id,"position","absolute");
      doc.style(item.id,"left",item.next.x+"px");
      doc.style(item.id,"top",item.next.y+"px");
    }
   });
  }catch(err){this.onError(err);this.canvas.render(this.canvas.file);}
 }
 cancel(){this.active=null;this.cursor();}
 cursor(){
  const pan=this.active?.type==="pan";
  this.root.dataset.panning=String(pan);
  this.root.dataset.panReady=String(this.space);
  const frame=this.canvas.editor.Canvas.getFrameEl();
  if(frame?.contentDocument?.body)frame.contentDocument.body.style.cursor=
    pan?"grabbing":this.space?"grab":this.mode==="free"?"move":"";
 }
 wheel(e,inside){
  if(!e.ctrlKey)return;
  this.stop(e);
  const current=this.canvas.editor.Canvas.getZoom(),delta=e.deltaY<0?1.1:1/1.1;
  this.zoom(clamp(Math.round(current*delta),20,300),this.point(e,inside));
 }
 zoom(percent,point=null){
  const c=this.canvas.editor.Canvas;
  const before=c.getZoom()||100,origin=this.coords();
  c.setZoom(clamp(percent,20,300));
  if(point){
   const hostRect=this.host.getBoundingClientRect(),
     x=point.x-hostRect.x,y=point.y-hostRect.y,ratio=c.getZoom()/before;
   this.setCoords(origin.x-(x*(ratio-1)),origin.y-(y*(ratio-1)));
  }
  this.onZoom?.(c.getZoom());
 }
 resetPan(){this.setCoords(0,0);}
 center(){const host=this.host.getBoundingClientRect(),width=Number(this.canvas.logicalWidth)||1440;
  const zoom=this.canvas.editor.Canvas.getZoom()/100;
  this.setCoords((host.width-width*zoom)/2,Math.max(0,host.height*.07));}
 setMode(mode){this.mode=mode==="free"?"free":"responsive";this.root.dataset.positionMode=this.mode;this.cancel();}
 apply(){
  this.root.dataset.canvasGrid=String(this.grid);
  this.root.dataset.canvasGuides=String(this.guides);
  this.root.style.setProperty("--ws-grid-size",this.spacing+"px");
  this.root.dataset.canvasSnap=String(this.snap);
 }
 toggleGrid(){this.grid=!this.grid;this.apply();return this.grid;}
 setSpacing(number){this.spacing=clamp(Math.round(Number(number)||16),4,128);this.apply();}
 dispose(){this.abort.abort();this.frameAbort?.abort();this.cancel();}
}
global.AgataWebCanvasInteraction={CanvasInteraction};
})(window);
