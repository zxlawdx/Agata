/* Navigation is an optional workspace overlay. Project events remain in the document. */
window.AgataNavigationRoutes=(()=>{
 'use strict';
 const ns='http://www.w3.org/2000/svg';
 function element(tag,attributes={}) {
  const result=document.createElementNS(ns,tag);
  for(const [key,value] of Object.entries(attributes))result.setAttribute(key,String(value));
  return result;
 }
 function route(source,target,offset) {
  const dx=target.position.x+target.width/2-source.position.x-source.width/2;
  const dy=target.position.y+target.height/2-source.position.y-source.height/2;
  let x,y,endX,endY,path,labelX,labelY;
  if(source.id===target.id){
   x=source.position.x+source.width+8;y=source.position.y+90+offset;endX=x;endY=y+56;
   const lane=x+65+offset;
   path=`M${x} ${y} L${lane} ${y} L${lane} ${endY} L${endX} ${endY}`;
   labelX=lane+6;labelY=y+28;
  }else if(Math.abs(dx)>=(source.width+target.width)/2+36){
   const forward=dx>0,dir=forward?1:-1;
   x=source.position.x+(forward?source.width+8:-8);
   endX=target.position.x+(forward?-8:target.width+8);
   y=source.position.y+Math.min(source.height/2,175)+offset;
   endY=target.position.y+Math.min(target.height/2,175)+offset;
   const lane=(x+endX)/2+dir*offset;
   path=`M${x} ${y} L${lane} ${y} L${lane} ${endY} L${endX} ${endY}`;
   labelX=lane+6;labelY=(y+endY)/2-8;
  }else{
   const forward=dy>=0,dir=forward?1:-1;
   x=source.position.x+Math.min(source.width/2,175)+offset;
   endX=target.position.x+Math.min(target.width/2,175)+offset;
   y=source.position.y+(forward?source.height+8:-8);
   endY=target.position.y+(forward?-8:target.height+8);
   const lane=(y+endY)/2+dir*offset;
   path=`M${x} ${y} L${x} ${lane} L${endX} ${lane} L${endX} ${endY}`;
   labelX=(x+endX)/2;labelY=lane-8;
  }
  return {path,labelX,labelY};
 }
 function draw(svg,screens,{visible=false,onSelect,onRemove}={}) {
  svg.replaceChildren();svg.hidden=!visible;
  svg.setAttribute('aria-hidden',String(!visible));
  if(!visible)return;
  const marker=element('marker',{id:'ad-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});
  marker.append(element('path',{d:'M0 0L10 5L0 10Z',fill:'#5a276c'}));
  const defs=element('defs');defs.append(marker);svg.append(defs);
  const targets=new Map(screens.map(screen=>[screen.id,screen]));
  const parallels=new Map();
  const labelBoxes=[];
  const collides=(box,other,pad=8)=>box.x<other.x+other.width+pad&&
    box.x+box.width+pad>other.x&&box.y<other.y+other.height+pad&&
    box.y+box.height+pad>other.y;
  const safeLabel=(x,y,caption)=>{
    const width=Math.max(55,caption.length*7.2+8),height=16;
    for(let attempt=0;attempt<36;attempt++){
      const row=Math.ceil(attempt/2),sign=attempt%2?1:-1;
      const cy=y+(attempt?sign*row*20:0);
      const cx=x+(attempt>20?((attempt-20)*12):0);
      const box={x:cx,y:cy-height,width,height};
      const frames=screens.map(s=>({x:s.position.x-8,y:s.position.y-8,width:s.width+16,height:s.height+16}));
      if(![...frames,...labelBoxes].some(previous=>collides(box,previous))){
        labelBoxes.push(box);return {x:cx,y:cy};
      }
    }
    const box={x,y:y-height,width,height};labelBoxes.push(box);return{x,y};
  };
  for(const screen of screens)window.AgataUIModel.walk(screen.root,node=>{
   const event=node.events?.onClick;
   if(event?.action!=='navigate')return;
   const target=targets.get(event.target);
   if(!target)return; // Never draw orphan references as random lines.
   const key=screen.id+':'+target.id;
   const count=parallels.get(key)||0;parallels.set(key,count+1);
   const {path,labelX,labelY}=route(screen,target,Math.min(count,8)*12);
   const line=element('path',{'class':'ad-connection',d:path,'marker-end':'url(#ad-arrow)',tabindex:0,role:'button','aria-label':'Editar onClick '+node.name});
   line.dataset.sourceNode=node.id;
   const title=element('title');title.textContent=node.name+' → '+target.name;line.append(title);
   line.addEventListener('click',()=>onSelect?.(node.id));
   line.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(node.id);}
    if(e.key==='Delete'){e.preventDefault();onRemove?.(node.id);}
   });
   svg.append(line);
   const caption='onClick · '+target.name;
   const position=safeLabel(labelX,labelY,caption);
   const label=element('text',{x:position.x,y:position.y,'class':'ad-nav-label',
     role:'note','aria-label':'Navegação '+node.name+' para '+target.name});
   label.textContent=caption;label.dataset.sourceNode=node.id;svg.append(label);
  });
 }
 return {draw,route};
})();
