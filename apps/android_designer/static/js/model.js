/* Semantic commands and history; contains no DOM/Fabric or code generation. */
window.AgataUIModel=(()=>{
 const clone=x=>JSON.parse(JSON.stringify(x)),id=prefix=>prefix+'_'+crypto.randomUUID().replaceAll('-','');
 function walk(node,fn,parent=null){fn(node,parent);for(const c of node.children)walk(c,fn,node);}
 function node(registry,type,props={},role=''){
  const spec=registry[type];if(!spec)throw Error('Componente desconhecido');
  return {id:id('n'),type,name:type,role,props:{...clone(spec.properties),...props},layout:clone(spec.layout),events:{},states:{},export:{},children:spec.children.map(c=>node(registry,c.type,c.props,c.role))};
 }
 class Document{
  constructor(value,registry){this.value=clone(value);this.registry=registry;this.past=[];this.future=[];this.saved=JSON.stringify(value);}
  transact(fn){const before=JSON.stringify(this.value);try{fn(this.value);this.repair();}catch(error){this.value=JSON.parse(before);throw error;}if(JSON.stringify(this.value)!==before){this.past.push(before);if(this.past.length>100)this.past.shift();this.future=[];}}
  get dirty(){return JSON.stringify(this.value)!==this.saved;}
  markSaved(){this.saved=JSON.stringify(this.value);}
  undo(){if(this.past.length){this.future.push(JSON.stringify(this.value));this.value=JSON.parse(this.past.pop());}}
  redo(){if(this.future.length){this.past.push(JSON.stringify(this.value));this.value=JSON.parse(this.future.pop());}}
  find(id){let result=null;for(const screen of this.value.screens)walk(screen.root,(n,parent)=>{if(n.id===id)result={node:n,parent,screen};});return result;}
  addScreen(){const s={id:id('s'),name:'Nova Screen',width:390,height:844,position:{x:Math.max(...this.value.screens.map(s=>s.position.x+s.width))+80,y:80},root:node(this.registry,'Column')};this.transact(d=>d.screens.push(s));return s;}
  duplicateScreen(screen){const copy=clone(screen),map=new Map();map.set(copy.id,id('s'));copy.id=map.get(copy.id);copy.name+=' cópia';copy.position.x+=440;walk(copy.root,n=>{map.set(n.id,id('n'));n.id=map.get(n.id);});for(const l of copy.layers||[]){l.id=id('l');l.nodes=l.nodes.map(id=>map.get(id)).filter(Boolean);}walk(copy.root,n=>{for(const link of Object.values(n.layout.constraints||{}))if(map.has(link.target))link.target=map.get(link.target);if(n.type==='Barrier')n.props.references=n.props.references.split(/\s+/).map(id=>map.get(id)).filter(Boolean).join(' ');if(n.events.onClick?.target===screen.id)n.events.onClick.target=copy.id;});this.transact(d=>d.screens.push(copy));return copy;}
  deleteScreen(screen){if(this.value.screens.length===1)throw Error('Mantenha ao menos uma Screen.');this.transact(d=>{d.screens=d.screens.filter(s=>s.id!==screen.id);if(d.start_screen===screen.id)d.start_screen=d.screens[0].id;for(const s of d.screens)walk(s.root,n=>{if(n.events.onClick?.target===screen.id||n.events.onClick?.popUpTo===screen.id)n.events.onClick.broken=true;});});}
  locked(id){let c=this.find(id);while(c){if(c.node.layout.locked||(c.screen.layers||[]).some(l=>l.locked&&l.nodes.includes(c.node.id)))return true;c=c.parent?this.find(c.parent.id):null;}return false;}
  accepts(parent,child){
   if(!this.registry[parent.type]?.container||this.locked(parent.id))return false;
   if(['Guideline','Barrier'].includes(child.type)&&parent.type!=='ConstraintLayout')return false;
   if(parent.type==='DrawingCanvas')return child.type==='Shape';
   if(parent.type==='BottomBar')return child.type==='NavigationItem';
   if(['Button','IconButton','FloatingButton','NavigationItem'].includes(parent.type))return ['TextLabel','Icon'].includes(child.type);
   if(['TextField','SearchBar'].includes(parent.type))return child.type==='Icon';
   return true;
  }
  topNodes(ids){const set=new Set(ids);let index=0;const order=new Map();for(const s of this.value.screens)walk(s.root,n=>order.set(n.id,index++));return [...set].map(id=>this.find(id)).filter(c=>c&& ![...set].some(other=>other!==c.node.id&&this.contains(other,c.node.id))).sort((a,b)=>order.get(a.node.id)-order.get(b.node.id));}
  contains(id,other){let found=false;const n=this.find(id)?.node;if(n)walk(n,c=>{if(c.id===other)found=true});return found;}
  insertNode(parentId,node,index){return this.insertNodes(parentId,[node],index)[0];}
  insertNodes(parentId,nodes,index){
   const parent=this.find(parentId)?.node;if(!parent||!nodes.length||nodes.some(n=>!this.accepts(parent,n)))throw Error('Destino não aceita estes componentes.');
   const existing=new Set();for(const s of this.value.screens)walk(s.root,n=>existing.add(n.id));const incoming=new Set();
   for(const node of nodes)walk(node,n=>{if(!this.registry[n.type]||existing.has(n.id)||incoming.has(n.id))throw Error('Tipo inválido ou ID duplicado.');incoming.add(n.id);});
   this.transact(()=>parent.children.splice(Math.max(0,Math.min(index??parent.children.length,parent.children.length)),0,...nodes));return nodes;
  }
  ungroupNode(id){const c=this.find(id);if(!c?.parent||!['Column','Row','Box','Grid'].includes(c.node.type)||this.locked(id)||c.node.children.some(n=>this.locked(n.id)||!this.accepts(c.parent,n)))throw Error('Não é possível desagrupar este contêiner.');
   this.transact(()=>{const index=c.parent.children.indexOf(c.node);c.parent.children.splice(index,1,...c.node.children);for(const child of c.node.children)if(!['Row','Column'].includes(c.parent.type))child.layout.weight=0;});
  }
  moveNodes(ids,parentId,index,position){
   const target=this.find(parentId)?.node,sources=this.topNodes(ids);if(!sources.length||!target)throw Error('Origem ou destino inexistente.');
   for(const source of sources){if(!source.parent||this.locked(source.node.id)||this.contains(source.node.id,parentId)||!this.accepts(target,source.node))throw Error('Movimento inválido: bloqueio, ciclo ou destino incompatível.');}
   this.transact(()=>{
    let at=index??target.children.length;
    for(const source of sources){const old=source.parent.children.indexOf(source.node);if(source.parent===target&&old<at)at--;source.parent.children.splice(old,1);}
    target.children.splice(Math.max(0,at),0,...sources.map(s=>s.node));
    for(const [i,source] of sources.entries()){
     // Weight is meaningful only in Row/Column without scroll.
     if(!['Row','Column'].includes(target.type)||target.layout.scroll!=='none')source.node.layout.weight=0;
     if(target.type==='ConstraintLayout'&&position&&!Object.keys(source.node.layout.constraints).length)Object.assign(source.node.layout,{x:position.x+i*8,y:position.y+i*8});
     if(target.type==='Box'&&target.layout.mode==='free'&&position){Object.assign(source.node.layout,{x:position.x+i*8,y:position.y+i*8,anchorX:'start',anchorY:'top'});if(source.node.layout.width==='fill'&&position.width)source.node.layout.width=Math.max(1,Math.round(position.width));if(source.node.layout.height==='fill'&&position.height)source.node.layout.height=Math.max(1,Math.round(position.height));}
    }
   });
  }
  resizeNode(id,width,height){const c=this.find(id);if(!c||this.locked(id))throw Error('Componente bloqueado ou inexistente.');if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width>4096||height>4096)throw Error('Tamanho inválido.');const l=c.node.layout;width=Math.max(l.minWidth,Math.min(l.maxWidth,width));height=Math.max(l.minHeight,Math.min(l.maxHeight,height));if(l.aspectRatio){const low=Math.max(l.minWidth,l.minHeight*l.aspectRatio),high=Math.min(l.maxWidth,l.maxHeight*l.aspectRatio);if(low>high)throw Error('Aspect ratio incompatível com os limites.');width=Math.max(low,Math.min(high,width));height=width/l.aspectRatio;}this.transact(()=>Object.assign(c.node.layout,{width,height}));}
  updateProperties(id,section,patch){const c=this.find(id);if(!c||this.locked(id))throw Error('Componente bloqueado.');if(!['props','layout'].includes(section))throw Error('Seção inválida.');this.transact(()=>Object.assign(c.node[section],patch));}
  deleteNodes(ids){const sources=this.topNodes(ids);if(sources.some(c=>!c.parent||this.locked(c.node.id)))throw Error('Raiz ou componente bloqueado.');this.transact(()=>{for(const c of sources)c.parent.children=c.parent.children.filter(n=>n.id!==c.node.id);});}
  groupNodes(ids,type='Column'){
   const nodes=this.topNodes(ids);if(!nodes.length||nodes.some(c=>!c.parent||c.parent!==nodes[0].parent||this.locked(c.node.id)))throw Error('Agrupe irmãos desbloqueados do mesmo contêiner.');
   const parent=nodes[0].parent,group=node(this.registry,type);if(!this.accepts(parent,group))throw Error('Destino não aceita grupo.');
   this.transact(()=>{const index=Math.min(...nodes.map(c=>parent.children.indexOf(c.node)));parent.children=parent.children.filter(n=>!nodes.some(c=>c.node===n));group.children=nodes.map(c=>c.node);parent.children.splice(index,0,group);});return group;
  }
  repair(){
   for(const s of this.value.screens){const own=new Set();walk(s.root,n=>own.add(n.id));s.layers=(s.layers||[]).map(l=>({...l,nodes:l.nodes.filter(id=>own.has(id))}));walk(s.root,n=>{
    for(const c of n.children){if(n.type!=='ConstraintLayout')c.layout.constraints={};else for(const [a,link] of Object.entries(c.layout.constraints||{}))if(link.target!=='parent'&&!n.children.some(s=>s.id===link.target))delete c.layout.constraints[a];}
    for(const helper of n.children.filter(c=>c.type==='Barrier')){helper.props.references=helper.props.references.split(/\s+/).filter(id=>n.children.some(c=>c.id===id)).join(' ');if(!helper.props.references)throw Error('Barrier sem alvos. Remova a Barrier junto com os componentes referenciados.');}
   });}
  }
  convertConstraint(id,rectangles={}){const c=this.find(id);if(!c||this.locked(id)||!['Column','Row','Box','Grid','Region'].includes(c.node.type))throw Error('Selecione um contêiner genérico para converter.');
   this.transact(()=>{const n=c.node;n.type='ConstraintLayout';n.props=clone(this.registry.ConstraintLayout.properties);n.layout.mode='constraint';for(const child of n.children){const r=rectangles[child.id];child.layout.weight=0;child.layout.constraints={};if(r){Object.assign(child.layout,{x:Math.max(0,Math.round(r.x)),y:Math.max(0,Math.round(r.y)),width:Math.max(1,Math.round(r.width)),height:Math.max(1,Math.round(r.height))});}}});
  }
  updateEvent(id,event){const c=this.find(id);if(!c||this.locked(id))throw Error('Componente bloqueado.');if(event?.action==='navigate'&&!this.value.screens.some(s=>s.id===event.target))throw Error('Destino inexistente.');this.transact(()=>{if(event)c.node.events.onClick=clone(event);else delete c.node.events.onClick;});}
  setConstraint(id,anchor,link){const found=this.find(id);if(!found?.parent||found.parent.type!=='ConstraintLayout'||this.locked(id))throw Error('Selecione filho desbloqueado de ConstraintLayout.');
   this.transact(()=>{if(link)found.node.layout.constraints[anchor]=clone(link);else delete found.node.layout.constraints[anchor];window.AgataConstraints.validate(found.parent);});
  }
  centerNode(id){const c=this.find(id);if(c?.parent?.type!=='ConstraintLayout'||['Guideline','Barrier'].includes(c.node.type)||this.locked(id))throw Error('Centralização requer pai ConstraintLayout.');this.transact(()=>{for(const a of ['start','end','top','bottom'])c.node.layout.constraints[a]={target:'parent',anchor:a,margin:0};delete c.node.layout.constraints.baseline;c.node.layout.horizontalBias=.5;c.node.layout.verticalBias=.5;});}
  addLayer(screen,ids,name='Nova camada'){const valid=this.topNodes(ids).filter(c=>c.screen===screen);if(!valid.length)throw Error('Selecione componentes desta Screen.');const layer={id:id('l'),name,nodes:valid.map(c=>c.node.id),visible:true,locked:false,opacity:1};this.transact(()=>{for(const l of screen.layers||[])l.nodes=l.nodes.filter(id=>!layer.nodes.includes(id));(screen.layers??=[]).push(layer);});return layer;}
  cloneNode(original){const c=clone(original),map=new Map();walk(c,n=>{map.set(n.id,id('n'));n.id=map.get(n.id);});walk(c,n=>{for(const [a,link] of Object.entries(n.layout.constraints||{}))if(map.has(link.target))link.target=map.get(link.target);else if(link.target!=='parent')delete n.layout.constraints[a];if(n.type==='Barrier')n.props.references=n.props.references.split(/\s+/).filter(id=>map.has(id)).map(id=>map.get(id)).join(' ');});return c;}

 }
 return {Document,node,walk,clone,id};
})();
