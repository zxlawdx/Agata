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
  transact(fn){const before=JSON.stringify(this.value);try{fn(this.value);}catch(error){this.value=JSON.parse(before);throw error;}if(JSON.stringify(this.value)!==before){this.past.push(before);if(this.past.length>100)this.past.shift();this.future=[];}}
  get dirty(){return JSON.stringify(this.value)!==this.saved;}
  markSaved(){this.saved=JSON.stringify(this.value);}
  undo(){if(this.past.length){this.future.push(JSON.stringify(this.value));this.value=JSON.parse(this.past.pop());}}
  redo(){if(this.future.length){this.past.push(JSON.stringify(this.value));this.value=JSON.parse(this.future.pop());}}
  find(id){let result=null;for(const screen of this.value.screens)walk(screen.root,(n,parent)=>{if(n.id===id)result={node:n,parent,screen};});return result;}
  addScreen(){const s={id:id('s'),name:'Nova Screen',width:390,height:844,position:{x:80+this.value.screens.length*480,y:80},root:node(this.registry,'Column')};this.transact(d=>d.screens.push(s));return s;}
  duplicateScreen(screen){const copy=clone(screen),map=new Map();map.set(copy.id,id('s'));copy.id=map.get(copy.id);copy.name+=' cópia';copy.position.x+=440;walk(copy.root,n=>{map.set(n.id,id('n'));n.id=map.get(n.id);});walk(copy.root,n=>{if(n.events.onClick?.target===screen.id)n.events.onClick.target=copy.id;});this.transact(d=>d.screens.push(copy));return copy;}
  deleteScreen(screen){if(this.value.screens.length===1)throw Error('Mantenha ao menos uma Screen.');this.transact(d=>{d.screens=d.screens.filter(s=>s.id!==screen.id);if(d.start_screen===screen.id)d.start_screen=d.screens[0].id;for(const s of d.screens)walk(s.root,n=>{if(n.events.onClick?.target===screen.id)delete n.events.onClick;});});}
  locked(id){let c=this.find(id);while(c){if(c.node.layout.locked)return true;c=c.parent?this.find(c.parent.id):null;}return false;}
  accepts(parent,child){
   if(!this.registry[parent.type]?.container||this.locked(parent.id))return false;
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
  cloneNode(original){const c=clone(original);walk(c,n=>n.id=id('n'));return c;}
 }
 return {Document,node,walk,clone,id};
})();
