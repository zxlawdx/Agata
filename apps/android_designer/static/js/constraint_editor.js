/* Layout constraints use semantic start/end, independently of navigation arrows.
   Hit testing is in viewport pixels, so snapping remains usable at every zoom. */
window.AgataConstraintEditor=(()=>{
 const axis=a=>['start','end'].includes(a)?'x':a==='baseline'?'baseline':'y';
 function nearest(candidates,current,x,y,radius=24){
  return candidates.filter(h=>h.parent===current.parent&&h.node!==current.id&&axis(h.anchor)===axis(current.anchor)&&h.valid!==false)
   .map(h=>({...h,distance:Math.hypot(h.x-x,h.y-y)})).filter(h=>h.distance<=radius).sort((a,b)=>a.distance-b.distance)[0]||null;
 }
 function route(p,q,a){const horizontal=axis(a)==='x',distance=Math.max(24,Math.min(100,Math.hypot(q.x-p.x,q.y-p.y)/2)),sign=['start','top'].includes(a)?-1:1;
  return horizontal?`M ${p.x} ${p.y} C ${p.x+sign*distance} ${p.y}, ${q.x-sign*distance} ${q.y}, ${q.x} ${q.y}`:`M ${p.x} ${p.y} C ${p.x} ${p.y+sign*distance}, ${q.x} ${q.y-sign*distance}, ${q.x} ${q.y}`;
 }
 function mount(root,{model,selection,commit,notify,enabled}){
  const abort=new AbortController(),on=(e,t,fn,opt={})=>e.addEventListener(t,fn,{...opt,signal:abort.signal}),host=root.querySelector('#ad-frames'),svgTag=tag=>document.createElementNS('http://www.w3.org/2000/svg',tag);
  let active=null,wire=null;
  const clear=()=>{active=null;wire?.remove();wire=null;root.querySelectorAll('.ad-anchor-target,.ad-anchor-incompatible').forEach(e=>e.classList.remove('ad-anchor-target','ad-anchor-incompatible'));};
  function candidates(current){return [...root.querySelectorAll('[data-constraint-node]')].map(h=>{
   const r=h.getBoundingClientRect(),node=model.find(h.dataset.constraintNode)?.node,a=h.dataset.anchor;
   const valid=node?.type==='Guideline'?axis(a)===(node.props.orientation==='vertical'?'x':'y'):node?.type==='Barrier'?axis(a)===(['start','end'].includes(node.props.direction)?'x':'y'):a!=='baseline'||node?.type==='TextLabel';
   return {element:h,node:h.dataset.constraintNode,parent:h.dataset.constraintParent,anchor:a,x:r.left+r.width/2,y:r.top+r.height/2,valid};
  });}
  function redraw(){
   if(active)clear();root.querySelectorAll('.ad-constraint-overlay').forEach(e=>e.remove());if(!enabled())return;const anchorsDrawn=new Set();
   for(const id of selection()){
    const c=model.find(id);if(c?.parent?.type!=='ConstraintLayout'||['Guideline','Barrier'].includes(c.node.type))continue;
    const parent=root.querySelector(`#ad-frames [data-node-id="${c.parent.id}"]`);if(!parent)continue;
    const overlay=document.createElement('div');overlay.className='ad-constraint-overlay';const hr=host.getBoundingClientRect(),pr=parent.getBoundingClientRect(),zs=hr.width/host.offsetWidth;
    Object.assign(overlay.style,{left:(pr.left-hr.left)/zs+'px',top:(pr.top-hr.top)/zs+'px',width:parent.offsetWidth+'px',height:parent.offsetHeight+'px'});host.append(overlay);
    const svg=svgTag('svg');svg.classList.add('ad-constraint-lines');svg.setAttribute('aria-label','Restrições de layout');overlay.append(svg);
    const box=parent.getBoundingClientRect(),scale=box.width/parent.offsetWidth,rtl=getComputedStyle(parent).direction==='rtl';
    const point=(element,a)=>{const r=element.getBoundingClientRect(),left=a===(rtl?'end':'start'),right=a===(rtl?'start':'end'),pad=element===parent?c.parent.layout.padding||0:0;return {x:((left?r.left:right?r.right:r.left+r.width/2)-box.left)/scale+(left?pad:right?-pad:0),y:((a==='top'?r.top:a==='bottom'?r.bottom:a==='baseline'?r.top+(model.find(element.dataset.nodeId)?.node.props.fontSize||16)*.8*scale:r.top+r.height/2)-box.top)/scale+(a==='top'?pad:a==='bottom'?-pad:0)};};
    if(!anchorsDrawn.has(c.parent.id))for(const [node,targetId] of [[c.parent,'parent'],...c.parent.children.map(n=>[n,n.id])]){
     const element=targetId==='parent'?parent:[...parent.children].find(e=>e.dataset.nodeId===node.id);if(!element)continue;
     let anchors=['start','end','top','bottom',...(node.type==='TextLabel'?['baseline']:[])];
     if(node.type==='Guideline')anchors=node.props.orientation==='vertical'?['start','end']:['top','bottom'];
     if(node.type==='Barrier')anchors=['start','end'].includes(node.props.direction)?['start','end']:['top','bottom'];
     for(const anchor of anchors){
      const h=document.createElement('button');h.type='button';h.className='ad-constraint-anchor';h.dataset.constraintNode=targetId;h.dataset.constraintParent=c.parent.id;h.dataset.anchor=anchor;h.setAttribute('aria-label',`${node.name} · ${anchor}`);h.title=h.getAttribute('aria-label')+' · Arraste para conectar; Ctrl+clique para remover';
      const p=point(element,anchor);Object.assign(h.style,{left:p.x+'px',top:p.y+'px',width:18/scale+'px',height:18/scale+'px'});if(targetId==='parent')h.style.zIndex=1000;if(selection().has(node.id)&&!['Guideline','Barrier'].includes(node.type)){h.dataset.constraintSource=node.id;h.style.zIndex=1100;h.classList.toggle('ad-anchor-connected',!!node.layout.constraints[anchor]);}overlay.append(h);
     }
    }
    anchorsDrawn.add(c.parent.id);
    const source=[...parent.children].find(e=>e.dataset.nodeId===id);
    if(source)for(const [a,link] of Object.entries(c.node.layout.constraints)){
     const target=link.target==='parent'?parent:[...parent.children].find(e=>e.dataset.nodeId===link.target);if(!target)continue;
     const p=point(source,a),q=point(target,link.anchor),line=svgTag('path');line.setAttribute('d',route(p,q,a));line.dataset.constraintLine=a;line.tabIndex=0;line.setAttribute('role','button');line.setAttribute('aria-label',`Restrição ${a}, margem ${link.margin}. Delete para remover`);
     // Selection is harmless; removal is explicit and one history entry.
     line.onclick=event=>{event.stopPropagation();line.focus();};line.onkeydown=event=>{if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopPropagation();try{model.setConstraint(id,a,null);commit();}catch(e){notify(e.message,true);}}};svg.append(line);
     if(link.margin){const label=svgTag('text');label.textContent=link.margin;label.setAttribute('x',(p.x+q.x)/2);label.setAttribute('y',(p.y+q.y)/2-5);svg.append(label);}
    }
   }
  }
  on(root,'pointerdown',event=>{
   const h=event.target.closest?.('[data-constraint-source]');if(!h||!enabled()||event.button!==0)return;
   event.preventDefault();event.stopImmediatePropagation();if(model.locked(h.dataset.constraintSource))return;
   if(event.ctrlKey||event.metaKey){try{model.setConstraint(h.dataset.constraintSource,h.dataset.anchor,null);commit();}catch(e){notify(e.message,true);}return;}
   const r=h.getBoundingClientRect();active={id:h.dataset.constraintSource,anchor:h.dataset.anchor,parent:h.dataset.constraintParent,x:r.left+r.width/2,y:r.top+r.height/2,pointer:event.pointerId,moved:false};
  },{capture:true});
  on(document,'pointermove',event=>{
   if(!active||event.pointerId!==active.pointer)return;if(Math.hypot(event.clientX-active.x,event.clientY-active.y)<3&&!active.moved)return;
   active.moved=true;if(!wire){wire=svgTag('svg');wire.classList.add('ad-live-wire');wire.append(svgTag('path'));root.append(wire);}
   const all=candidates(active),target=nearest(all,active,event.clientX,event.clientY);root.querySelectorAll('.ad-anchor-target').forEach(e=>e.classList.remove('ad-anchor-target'));target?.element.classList.add('ad-anchor-target');
   for(const h of all)h.element.classList.toggle('ad-anchor-incompatible',h.parent!==active.parent||h.node===active.id||axis(h.anchor)!==axis(active.anchor)||!h.valid);
   wire.firstChild.setAttribute('d',route(active,target||{x:event.clientX,y:event.clientY},active.anchor));
  });
  on(document,'pointerup',event=>{
   if(!active||event.pointerId!==active.pointer)return;const current=active,target=nearest(candidates(current),current,event.clientX,event.clientY);clear();event.preventDefault();event.stopImmediatePropagation();if(!current.moved)return;
   if(!target){const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-constraint-node]');notify(hit&&axis(hit.dataset.anchor)!==axis(current.anchor)?'Eixos incompatíveis.':'Conexão cancelada: solte próximo de uma âncora compatível.',true);return;}
   try{model.setConstraint(current.id,current.anchor,{target:target.node,anchor:target.anchor,margin:0});commit();}catch(e){notify(e.message,true);redraw();}
  },{capture:true});
  on(document,'keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();e.stopImmediatePropagation();clear();}},{capture:true});on(document,'pointercancel',clear);on(window,'blur',clear);
  return {redraw,dispose(){abort.abort();clear();root.querySelectorAll('.ad-constraint-overlay').forEach(e=>e.remove());}};
 }
 return {mount,nearest,route};
})();
