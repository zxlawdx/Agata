/* Shared layout rules. Browser flex/grid performs intrinsic text measurement;
   measured rectangles are the authoritative geometry for hit testing/diagnostics. */
window.AgataLayout=(()=>{
 const sizeClass=w=>w<600?'compact':w<840?'medium':'expanded';
 function resolve(layout,width=390,height=844){return {...layout,...layout.responsive?.[sizeClass(width)],...(width>height?layout.responsive?.landscape:{})};}
 function apply(element,node,options){
  const l=resolve(node.layout,options.width,options.height),parent=options.parentLayout;
  Object.assign(element.style,{minWidth:l.minWidth+'px',maxWidth:l.maxWidth+'px',minHeight:l.minHeight+'px',maxHeight:l.maxHeight+'px',margin:l.margin+'px'});
  element.dataset.layoutMode=l.mode;element.dataset.locked=String(l.locked);
  if(!l.visible){element.hidden=true;return;}
  if(l.aspectRatio){element.style.aspectRatio=String(l.aspectRatio);if(l.height==='wrap')element.style.height='auto';}
  if(l.weight&&parent&&['Row','Column'].includes(options.parentType)){element.style.flex=`${l.weight} 1 0px`;element.style[options.parentType==='Row'?'width':'height']='0px';}
  if(node.children.length===0&&['Column','Row','Box','Grid','Card','Surface'].includes(node.type))element.style.minHeight=Math.max(l.minHeight,40)+'px';
  if(node.type==='Grid'){Object.assign(element.style,{display:'grid',gridTemplateColumns:`repeat(${l.columns},minmax(0,1fr))`,alignItems:'start'});}
  if(node.type==='Row'&&l.wrap)element.style.flexWrap='wrap';
  if(node.type==='Box'&&l.mode==='free'){
   Object.assign(element.style,{display:'block',position:'relative',minHeight:Math.max(l.minHeight,80)+'px'});
   for(const child of element.querySelectorAll(':scope > [data-node-id]')){
    const n=node.children.find(n=>n.id===child.dataset.nodeId);if(!n)continue;const c=resolve(n.layout,options.width,options.height);
    Object.assign(child.style,{position:'absolute',gridArea:'auto'});
    child.style.left=c.anchorX==='end'?'auto':c.anchorX==='center'?`calc(50% + ${c.x}px)`:c.x+'px';
    child.style.right=c.anchorX==='end'?c.x+'px':c.anchorX==='fill'?'0':'auto';
    child.style.top=c.anchorY==='bottom'?'auto':c.anchorY==='center'?`calc(50% + ${c.y}px)`:c.y+'px';
    child.style.bottom=c.anchorY==='bottom'?c.y+'px':c.anchorY==='fill'?'0':'auto';
    child.style.transform=`translate(${c.anchorX==='center'?'-50%':'0'},${c.anchorY==='center'?'-50%':'0'})`;
    if(c.anchorX==='fill')child.style.width='auto';if(c.anchorY==='fill')child.style.height='auto';
   }
  }
  if(node.type==='TextLabel'){
   element.style.fontSize=node.props.fontSize*(options.fontScale||1)+'px';
   if(node.props.maxLines){Object.assign(element.style,{display:'-webkit-box',webkitBoxOrient:'vertical',webkitLineClamp:String(node.props.maxLines),overflow:'hidden'});element.style.textOverflow=node.props.overflow==='ellipsis'?'ellipsis':'clip';}
  }
 }
 function measure(host){
  const root=host.getBoundingClientRect(),scale=host.offsetWidth?root.width/host.offsetWidth:1,rectangles=new Map(),warnings=[];
  for(const element of host.querySelectorAll('[data-node-id]')){
   if(element.hidden||!element.getClientRects().length)continue;const r=element.getBoundingClientRect(),p=element.parentElement,pr=p.getBoundingClientRect();
   rectangles.set(element.dataset.nodeId,{x:(r.left-root.left)/scale,y:(r.top-root.top)/scale,width:r.width/scale,height:r.height/scale});
   const style=getComputedStyle(p);const unexpected=((r.right>pr.right+2||r.left<pr.left-2)&&!['auto','scroll'].includes(style.overflowX))||((r.bottom>pr.bottom+2||r.top<pr.top-2)&&!['auto','scroll'].includes(style.overflowY));
   if(unexpected)warnings.push({id:element.dataset.nodeId,kind:'overflow',message:'Componente ultrapassa o contêiner: '+element.dataset.type});
   if(element.dataset.type==='TextLabel'&&element.scrollHeight>element.clientHeight+2)warnings.push({id:element.dataset.nodeId,kind:'text',message:'Texto truncado: '+element.textContent.slice(0,40)});
   if(['Button','IconButton','NavigationItem'].includes(element.dataset.type)&&Math.min(r.width,r.height)/scale<24)warnings.push({id:element.dataset.nodeId,kind:'touch',message:'Área de toque abaixo de 24 unidades.'});
  }
  return {rectangles,warnings};
 }
 return {sizeClass,resolve,apply,measure};
})();
