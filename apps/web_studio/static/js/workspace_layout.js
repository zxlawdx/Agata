/* Agata Workspace: resizable accessible panels + zoom independent from site viewport.
 * UI-only state. Never touches project HTML/CSS/JS or saved design tokens.
 */
(function(global){
"use strict";
const MIN_LEFT=185,MAX_LEFT=420,MIN_RIGHT=230,MAX_RIGHT=480,MIN_CENTER=360;
const clamp=(v,min,max)=>Math.min(Math.max(v,min),max);
class WorkspaceLayoutManager {
  constructor(root,{onResize,onUpdate}={}){
    this.root=root;this.onResize=onResize||(()=>{});this.onUpdate=onUpdate||(()=>{});
    this.abort=new AbortController();
    this.key="agata-web-layout-v2:"+(root.dataset.projectId||"unbound");
    this.drag=null;this.mode="split";this.focus=false;
    this.state={left:"visible",right:"visible",leftWidth:245,rightWidth:290,splitRatio:.50,
      zoomMode:"fit-width",zoomPercent:100};
    try{
      const value=JSON.parse(localStorage.getItem(this.key)||"{}");
      for(const field of Object.keys(this.state))
        if(Object.prototype.hasOwnProperty.call(value,field))this.state[field]=value[field];
    }catch{}
    const on=(el,event,handler)=>el?.addEventListener(event,handler,{signal:this.abort.signal});
    const bind=(id,axis)=>{const node=root.querySelector("#"+id);
      on(node,"pointerdown",event=>this.start(event,axis,node));
      on(node,"keydown",event=>{const key=axis==="split"?"ArrowLeft":"ArrowRight";
        if(!["ArrowLeft","ArrowRight","Home"].includes(event.key))return;
        event.preventDefault();
        if(event.key==="Home")this.set(axis,axis==="split"?.50:axis==="left"?245:290);
        else this.set(axis,(axis==="split"?this.state.splitRatio*1000:this.state[axis+"Width"])+
          (event.key===key?16:-16),axis==="split");
      });
    };
    bind("ws-left-splitter","left");
    bind("ws-right-splitter","right");
    bind("ws-center-splitter","split");
    on(root.querySelector("#ws-layout-reset"),"click",()=>this.reset());
    on(root.querySelector("#ws-focus-mode"),"click",()=>this.toggleFocus());
    on(global,"resize",()=>this.apply());
    this.apply();
  }
  workspaceWidth(){return this.root.querySelector(".ws-layout").getBoundingClientRect().width||innerWidth;}
  setMode(mode){this.mode=mode;this.apply();}
  persist(){try{localStorage.setItem(this.key,JSON.stringify(this.state));}catch{}}
  reset(){
    Object.assign(this.state,{left:"visible",right:"visible",leftWidth:245,rightWidth:290,splitRatio:.50,
      zoomMode:"fit-width",zoomPercent:100});
    this.focus=false;this.root.dataset.focus="false";this.apply();this.persist();this.onUpdate();
  }
  toggleFocus(){
    this.focus=!this.focus;this.root.dataset.focus=String(this.focus);
    const btn=this.root.querySelector("#ws-focus-mode");
    if(btn)btn.setAttribute("aria-pressed",String(this.focus));
    this.apply();this.onUpdate();
  }
  toggle(side){
    if(!["left","right"].includes(side))return;
    this.state[side]=this.state[side]==="hidden"?"visible":"hidden";
    this.apply();this.persist();this.onUpdate();
  }
  set(axis,value,isRatio=false){
    if(axis==="split")this.state.splitRatio=clamp(isRatio?value:value/1000,.23,.77);
    else{
      const viewport=this.workspaceWidth();
      const opposite=axis==="left"?"right":"left";
      const other=(this.state[opposite]==="visible"&&!this.focus)?this.state[opposite+"Width"]+6:0;
      const max=Math.max(axis==="left"?MIN_LEFT:MIN_RIGHT,
        Math.min(axis==="left"?MAX_LEFT:MAX_RIGHT,viewport-other-MIN_CENTER-12));
      this.state[axis+"Width"]=clamp(Math.round(value),axis==="left"?MIN_LEFT:MIN_RIGHT,max);
    }
    this.apply();this.persist();this.onUpdate();
  }
  start(event,axis,node){
    if(event.button!==0)return;event.preventDefault();
    node.setPointerCapture(event.pointerId);
    const rect=this.root.querySelector(".ws-editors").getBoundingClientRect();
    this.drag={axis,start:event.clientX,initial:axis==="split"?this.state.splitRatio:
      this.state[axis+"Width"],width:rect.width,pointer:event.pointerId};
    const signal=this.abort.signal;
    const move=e=>{
      if(!this.drag||e.pointerId!==this.drag.pointer)return;
      const delta=e.clientX-this.drag.start;
      const value=axis==="split"?this.drag.initial+delta/Math.max(this.drag.width,1):
        this.drag.initial+(axis==="right"?-delta:delta);
      this.set(axis,value,axis==="split");
    };
    const stop=e=>{if(!this.drag||e.pointerId!==this.drag.pointer)return;
      this.drag=null;node.removeEventListener("pointermove",move);node.removeEventListener("pointerup",stop);
      node.removeEventListener("pointercancel",stop);
      try{node.releasePointerCapture(e.pointerId);}catch{}
      this.persist();this.onResize();
    };
    node.addEventListener("pointermove",move,{signal});
    node.addEventListener("pointerup",stop,{signal});
    node.addEventListener("pointercancel",stop,{signal});
  }
  apply(){
    if(!this.root.isConnected)return;
    const small=innerWidth<=900;
    const leftOn=this.state.left==="visible"&&!this.focus;
    const rightOn=this.state.right==="visible"&&!this.focus&&this.mode!=="preview";
    this.root.dataset.left=leftOn?"visible":"hidden";
    this.root.dataset.right=rightOn?"visible":"hidden";
    this.root.dataset.focus=String(this.focus);
    const viewport=this.workspaceWidth();
    const left=clamp(this.state.leftWidth,MIN_LEFT,Math.max(MIN_LEFT,viewport-MIN_CENTER-16));
    const right=clamp(this.state.rightWidth,MIN_RIGHT,Math.max(MIN_RIGHT,viewport-MIN_CENTER-16-(leftOn?left:0)));
    this.root.style.setProperty("--ws-left",left+"px");
    this.root.style.setProperty("--ws-right",right+"px");
    this.root.style.setProperty("--ws-design-percent",(this.state.splitRatio*100).toFixed(1)+"%");
    for(const side of ["left","right"]){
      const btn=this.root.querySelector('[data-action="'+side+'"]');
      if(btn){btn.setAttribute("aria-expanded",String(this.state[side]==="visible"&&!this.focus));}
    }
    const center=this.root.querySelector("#ws-center-splitter");
    if(center){
      center.setAttribute("aria-valuenow",String(Math.round(this.state.splitRatio*100)));
      center.setAttribute("aria-valuetext",Math.round(this.state.splitRatio*100)+"% canvas, "+Math.round((1-this.state.splitRatio)*100)+"% código");
    }
    this.onResize();
  }
  dispose(){this.abort.abort();this.drag=null;}
}
class CanvasZoomController {
 constructor(canvas,getWidth,getHost){
   this.canvas=canvas;this.getWidth=getWidth;this.getHost=getHost;
   this.mode="fit-width";this.percent=100;
 }
 setViewport(width){this.canvas.logicalWidth=width;
   this.canvas.width(width);this.apply();}
 fit(mode="fit-width"){this.mode=mode;this.apply();}
 setPercent(percent){this.mode="custom";this.percent=clamp(Number(percent)||100,20,300);this.apply();}
 step(direction){this.setPercent(this.value()+15*direction);}
 value(){return Math.round(this.canvas.editor.Canvas.getZoom()||100);}
 apply(){
   const width=Number(this.getWidth())||1440;
   const host=this.getHost(),frame=host?.getBoundingClientRect();
   if(!frame||frame.width<50)return;
   let value=this.percent;
   if(this.mode!=="custom"){
      const usable=Math.max(100,frame.width-28);
      value=usable/width*100;
      if(this.mode==="fit-screen"){
        const doc=this.canvas.editor.Canvas.getDocument();
        const height=doc?.documentElement?.scrollHeight||900;
        value=Math.min(value,(Math.max(200,frame.height-28)/height)*100);
      }
   }
   this.canvas.editor.Canvas.setZoom(clamp(value,this.mode==="custom"?20:5,300));
   return this.value();
 }
}
global.AgataWebWorkspaceLayout={WorkspaceLayoutManager,CanvasZoomController};
})(window);
