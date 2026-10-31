/* Required, acyclic constraints. Pure geometry; intrinsic sizes are supplied by renderer.
   Each widget solves a 4-variable linear system; barriers are dependency extrema. */
window.AgataConstraints=(()=>{
 const axes={start:'x',end:'x',top:'y',bottom:'y',baseline:'baseline'};
 function linear(rows){
  const a=rows.map(r=>r.slice()),count=a.length;
  for(let k=0;k<count;k++){let pivot=k;for(let j=k+1;j<count;j++)if(Math.abs(a[j][k])>Math.abs(a[pivot][k]))pivot=j;
   if(Math.abs(a[pivot][k])<1e-8)throw Error('Restrições subdeterminadas.');[a[k],a[pivot]]=[a[pivot],a[k]];const scale=a[k][k];for(let i=k;i<=count;i++)a[k][i]/=scale;
   for(let j=0;j<count;j++)if(j!==k){const factor=a[j][k];for(let i=k;i<=count;i++)a[j][i]-=factor*a[k][i];}
  }return a.map(r=>r[count]);
 }
 function validate(parent){
  const nodes=new Map(parent.children.map(n=>[n.id,n])),visiting=new Set(),done=new Set();
  function visit(n){if(visiting.has(n.id))throw Error('Ciclo de constraints. Chains recíprocas não suportadas.');if(done.has(n.id))return;visiting.add(n.id);const c=n.layout.constraints||{};
   if(c.baseline&&(c.top||c.bottom))throw Error('Baseline conflita com top/bottom.');
   if(['Guideline','Barrier'].includes(n.type)&&Object.keys(c).length)throw Error('Helpers não recebem links.');
   for(const [anchor,link] of Object.entries(c)){
    const target=nodes.get(link.target);if(!axes[anchor]||axes[anchor]!==axes[link.anchor])throw Error('Eixos incompatíveis.');
    if(link.target!=='parent'&&(!target||target===n))throw Error('Alvo deve ser pai ou irmão distinto.');
    if(!Number.isFinite(link.margin)||link.margin<0||link.margin>4096)throw Error('Margem inválida.');
    if(anchor==='baseline'&&link.margin!==0)throw Error('Baseline suporta margem zero nesta versão.');
    if(anchor==='baseline'&&(n.type!=='TextLabel'||target?.type!=='TextLabel'))throw Error('Baseline requer TextLabels.');
    if(target?.type==='Guideline'&&axes[anchor]!== (target.props.orientation==='vertical'?'x':'y'))throw Error('Eixo da guideline incompatível.');
    if(target?.type==='Barrier'&&axes[anchor]!==(['start','end'].includes(target.props.direction)?'x':'y'))throw Error('Eixo da barrier incompatível.');
    if(target)visit(target);
   }
   if(n.type==='Barrier'){const refs=n.props.references.trim().split(/\s+/);if(!refs.length||refs.some(id=>!nodes.has(id)||id===n.id||['Guideline','Barrier'].includes(nodes.get(id).type)))throw Error('Referências de barrier inválidas.');for(const id of refs)visit(nodes.get(id));}
   visiting.delete(n.id);done.add(n.id);
  }for(const n of nodes.values())visit(n);
 }
 function solve(parent,width,height,sizes={},rtl=false){
  validate(parent);const nodes=new Map(parent.children.map(n=>[n.id,n])),rects={},warnings=[];const pad=parent.layout.padding||0;
  const bounds={x:pad,y:pad,width:Math.max(0,width-2*pad),height:Math.max(0,height-2*pad),baseline:0};
  const edge=(r,a)=>a==='start'?(rtl?r.x+r.width:r.x):a==='end'?(rtl?r.x:r.x+r.width):a==='top'?r.y:a==='bottom'?r.y+r.height:r.y+(r.baseline||0);
  function visit(n){if(rects[n.id])return rects[n.id];const l=n.layout,p=n.props;
   if(n.type==='Guideline'){const vertical=p.orientation==='vertical',pos=p.percent*(vertical?bounds.width:bounds.height)+(vertical?pad:pad);return rects[n.id]={x:vertical?(rtl?width-pos:pos):pad,y:vertical?pad:pos,width:vertical?0:bounds.width,height:vertical?bounds.height:0,baseline:0};}
   if(n.type==='Barrier'){const refs=p.references.trim().split(/\s+/).map(id=>visit(nodes.get(id))),values=refs.map(r=>edge(r,p.direction));const isMin=['start','top'].includes(p.direction)!=(rtl&&['start','end'].includes(p.direction));const value=(isMin?Math.min(...values):Math.max(...values))+(isMin?-1:1)*p.barrierMargin;const horizontal=['start','end'].includes(p.direction);return rects[n.id]={x:horizontal?value:pad,y:horizontal?pad:value,width:horizontal?0:bounds.width,height:horizontal?bounds.height:0,baseline:0};}
   const c=l.constraints||{},measured=sizes[n.id]||{width:100,height:48,baseline:16};const rows=[];
   for(const [axis,start,end,pos,dimension,bias] of [['x','start','end',0,1,'horizontalBias'],['y','top','bottom',2,3,'verticalBias']]){
    const low=c[start],high=c[end],span=axis==='x'?bounds.width:bounds.height;const sizeKey=axis==='x'?'width':'height';let size=typeof l[sizeKey]==='number'?l[sizeKey]:measured[sizeKey];
    if(l.aspectRatio){if(axis==='y'&&l.height==='wrap')size=(typeof l.width==='number'?l.width:measured.width)/l.aspectRatio;}
    size=Math.max(l['min'+(axis==='x'?'Width':'Height')],Math.min(l['max'+(axis==='x'?'Width':'Height')],size));
    const target=link=>edge(link.target==='parent'?bounds:visit(nodes.get(link.target)),link.anchor);
    const sign=axis==='x'&&rtl?-1:1;const a=low?target(low)+sign*low.margin:0,b=high?target(high)-sign*high.margin:0;
    const add=(pval,dval,value)=>{const row=[0,0,0,0,value];row[pos]=pval;row[dimension]=dval;rows.push(row);};
    if(axis==='y'&&c.baseline){add(1,0,target(c.baseline)+c.baseline.margin-(measured.baseline||0));add(0,1,size);continue;}
    if(low&&high&&l[sizeKey]==='fill'){
     size=Math.max(l['min'+(axis==='x'?'Width':'Height')],Math.min(l['max'+(axis==='x'?'Width':'Height')],sign*(b-a)));add(0,1,size);add(1,0,rtl&&axis==='x'?a-size-(a-b-size)*l[bias]:a+(b-a-size)*l[bias]);
    }else{add(0,1,size);if(low&&high)add(1,0,sign===1?a+(b-a-size)*l[bias]:a-size-(a-b-size)*l[bias]);else if(low)add(1,sign===1?0:1,a);else if(high)add(1,sign===1?1:0,b);else{add(1,0,pad+(axis==='x'?l.x:l.y));warnings.push({id:n.id,kind:'underconstrained',message:n.name+': falta restrição '+axis+'; posição livre preservada.'});}}
    if(low&&high&&sign*(b-a)<size-.1)warnings.push({id:n.id,kind:'conflict',message:n.name+': espaço entre âncoras menor que o tamanho mínimo/fixo.'});
   }
   const [x,w,y,h]=linear(rows);return rects[n.id]={x,y,width:w,height:h,baseline:measured.baseline||0};
  }for(const n of parent.children)visit(n);return {rectangles:rects,warnings};
 }
 function layout(element,node,options){
  if(node.type!=='ConstraintLayout')return;
  element.style.display='block';element.style.position='relative';if(node.layout.height==='wrap')element.style.minHeight='300px';
  const apply=()=>{const sizes={},elements=new Map([...element.children].filter(e=>e.dataset.nodeId).map(e=>[e.dataset.nodeId,e]));
   for(const n of node.children){const e=elements.get(n.id);if(!e)continue;const l=n.layout;Object.assign(e.style,{position:'absolute',left:'0',top:'0',width:typeof l.width==='number'?l.width+'px':l.width==='fill'?'100px':'max-content',height:typeof l.height==='number'?l.height+'px':'max-content'});sizes[n.id]={width:e.offsetWidth,height:e.offsetHeight,baseline:(n.props.fontSize||16)*(options.fontScale||1)*.8};}
   try{const result=solve(node,element.clientWidth,element.clientHeight,sizes,options.rtl);element._constraintWarnings=result.warnings;
    for(const [id,r] of Object.entries(result.rectangles)){const e=elements.get(id);if(!e)continue;Object.assign(e.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});}
   }catch(error){element._constraintWarnings=[{id:node.id,kind:'constraint',message:error.message}];}
  };element._solveConstraints=apply;requestAnimationFrame(apply);
 }
 function layered(screen){const s=JSON.parse(JSON.stringify(screen)),nodes=new Map();window.AgataUIModel.walk(s.root,n=>nodes.set(n.id,n));for(const [order,layer] of (s.layers||[]).entries())for(const id of layer.nodes){const n=nodes.get(id);if(n){n.layout.visible&&=layer.visible;n.layout.locked||=layer.locked;if(!layer.visible)for(const rule of Object.values(n.layout.responsive))rule.visible=false;n._layer={order:order+1,opacity:layer.opacity};}}return s;}
 return {linear,validate,solve,layout,layered};
})();
