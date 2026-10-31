/* Layout anchors are cyan; route arrows remain purple and between Screens. */
window.AgataConstraintEditor={mount(root,{model,selection,commit,notify,enabled}){
 const abort=new AbortController(),on=(e,t,fn,opt={})=>e.addEventListener(t,fn,{...opt,signal:abort.signal});let active=null,wire=null;
 const host=root.querySelector('#ad-frames');
 const clearWire=()=>{wire?.remove();wire=null;};
 const svgTag=tag=>document.createElementNS('http://www.w3.org/2000/svg',tag);
 function redraw(){
  root.querySelectorAll('.ad-constraint-overlay').forEach(e=>e.remove());if(!enabled())return;
  for(const id of selection()){
   const c=model.find(id);if(c?.parent?.type!=='ConstraintLayout')continue;const parent=root.querySelector(`#ad-frames [data-node-id="${c.parent.id}"]`);if(!parent)continue;
   const overlay=document.createElement('div');overlay.className='ad-constraint-overlay';const hr=host.getBoundingClientRect(),pr=parent.getBoundingClientRect(),zs=hr.width/host.offsetWidth;Object.assign(overlay.style,{left:(pr.left-hr.left)/zs+'px',top:(pr.top-hr.top)/zs+'px',width:parent.offsetWidth+'px',height:parent.offsetHeight+'px'});host.append(overlay);
   const svg=svgTag('svg');svg.classList.add('ad-constraint-lines');svg.setAttribute('aria-label','Restrições de layout');overlay.append(svg);
   const box=parent.getBoundingClientRect(),scale=box.width/parent.offsetWidth;
   const point=(element,a)=>{const r=element.getBoundingClientRect();return {x:((a==='start'?r.left:a==='end'?r.right:r.left+r.width/2)-box.left)/scale,y:((a==='top'?r.top:a==='bottom'?r.bottom:a==='baseline'?r.top+r.height*.8:r.top+r.height/2)-box.top)/scale};};
   for(const [node,targetId] of [[c.parent,'parent'],...c.parent.children.map(n=>[n,n.id])]){
    const element=targetId==='parent'?parent:[...parent.children].find(e=>e.dataset.nodeId===node.id);if(!element)continue;
    for(const anchor of ['start','end','top','bottom',...(node.type==='TextLabel'?['baseline']:[])]){
     const h=document.createElement('button');h.type='button';h.className='ad-constraint-anchor';h.dataset.constraintNode=targetId;h.dataset.constraintParent=c.parent.id;h.dataset.anchor=anchor;h.setAttribute('aria-label',`${node.name} · ${anchor}`);h.title=h.getAttribute('aria-label');
     const p=point(element,anchor);h.style.left=p.x+'px';h.style.top=p.y+'px';h.style.width=18/scale+'px';h.style.height=18/scale+'px';if(targetId==='parent')h.style.zIndex=1000;if(node.id===id){h.dataset.constraintSource=id;h.style.zIndex=1100;}overlay.append(h);
    }
   }
   const source=[...parent.children].find(e=>e.dataset.nodeId===id);
   if(source)for(const [a,link] of Object.entries(c.node.layout.constraints)){
    const target=link.target==='parent'?parent:[...parent.children].find(e=>e.dataset.nodeId===link.target);if(!target)continue;
    const p=point(source,a),q=point(target,link.anchor),line=svgTag('line');for(const [key,v] of Object.entries({x1:p.x,y1:p.y,x2:q.x,y2:q.y}))line.setAttribute(key,v);line.dataset.constraintLine=a;line.tabIndex=0;line.setAttribute('role','button');line.setAttribute('aria-label','Remover restrição '+a);line.onclick=()=>{try{model.setConstraint(id,a,null);commit();}catch(e){notify(e.message,true);}};line.onkeydown=e=>{if(['Delete','Enter'].includes(e.key))line.onclick();};svg.append(line);
   }
  }
 }
 on(root,'pointerdown',event=>{const h=event.target.closest?.('[data-constraint-source]');if(!h||!enabled())return;event.preventDefault();event.stopImmediatePropagation();if(event.ctrlKey||event.metaKey){model.setConstraint(h.dataset.constraintSource,h.dataset.anchor,null);commit();return;}active={id:h.dataset.constraintSource,anchor:h.dataset.anchor,parent:h.dataset.constraintParent,x:event.clientX,y:event.clientY};wire=svgTag('svg');wire.classList.add('ad-live-wire');wire.append(svgTag('line'));root.append(wire);}, {capture:true});
 on(document,'pointermove',event=>{if(!active)return;const line=wire?.firstChild;if(line)for(const [k,v] of Object.entries({x1:active.x,y1:active.y,x2:event.clientX,y2:event.clientY}))line.setAttribute(k,v);root.querySelectorAll('.ad-anchor-target').forEach(e=>e.classList.remove('ad-anchor-target'));const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-constraint-node]');if(target)target.classList.add('ad-anchor-target');});
 on(document,'pointerup',event=>{if(!active)return;const current=active;active=null;clearWire();event.preventDefault();event.stopImmediatePropagation();const h=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-constraint-node]');try{if(!h||h.dataset.constraintParent!==current.parent)throw Error('Solte em uma âncora do mesmo contêiner.');model.setConstraint(current.id,current.anchor,{target:h.dataset.constraintNode,anchor:h.dataset.anchor,margin:0});commit();}catch(e){notify(e.message,true);redraw();}}, {capture:true});
 on(document,'keydown',e=>{if(e.key==='Escape'){active=null;clearWire();redraw();}});on(document,'pointercancel',()=>{active=null;clearWire();redraw();});
 return {redraw,dispose(){abort.abort();active=null;clearWire();}};
}};
