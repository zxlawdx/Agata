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
  transact(fn){const before=JSON.stringify(this.value);fn(this.value);if(JSON.stringify(this.value)!==before){this.past.push(before);if(this.past.length>100)this.past.shift();this.future=[];}}
  get dirty(){return JSON.stringify(this.value)!==this.saved;}
  markSaved(){this.saved=JSON.stringify(this.value);}
  undo(){if(this.past.length){this.future.push(JSON.stringify(this.value));this.value=JSON.parse(this.past.pop());}}
  redo(){if(this.future.length){this.past.push(JSON.stringify(this.value));this.value=JSON.parse(this.future.pop());}}
  find(id){let result=null;for(const screen of this.value.screens)walk(screen.root,(n,parent)=>{if(n.id===id)result={node:n,parent,screen};});return result;}
  addScreen(){const s={id:id('s'),name:'Nova Screen',width:390,height:844,position:{x:80+this.value.screens.length*480,y:80},root:node(this.registry,'Column')};this.transact(d=>d.screens.push(s));return s;}
  duplicateScreen(screen){const copy=clone(screen),map=new Map();map.set(copy.id,id('s'));copy.id=map.get(copy.id);copy.name+=' cópia';copy.position.x+=440;walk(copy.root,n=>{map.set(n.id,id('n'));n.id=map.get(n.id);});walk(copy.root,n=>{if(n.events.onClick?.target===screen.id)n.events.onClick.target=copy.id;});this.transact(d=>d.screens.push(copy));return copy;}
  deleteScreen(screen){if(this.value.screens.length===1)throw Error('Mantenha ao menos uma Screen.');this.transact(d=>{d.screens=d.screens.filter(s=>s.id!==screen.id);if(d.start_screen===screen.id)d.start_screen=d.screens[0].id;for(const s of d.screens)walk(s.root,n=>{if(n.events.onClick?.target===screen.id)delete n.events.onClick;});});}
  cloneNode(original){const c=clone(original);walk(c,n=>n.id=id('n'));return c;}
 }
 return {Document,node,walk,clone,id};
})();
