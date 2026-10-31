/* Optional Compose presentation on the existing IR. CSS px represent logical dp;
   workspace zoom is an outer transform, independent of density and font scale. */
window.AgataComposePresentation=(()=>{
 const fontLoads=new Map();
 function test(rule,width,height){if(!rule)return null;const actual=rule.axis==='width'?width:height;return {'>=':actual>=rule.value,'>':actual>rule.value,'<=':actual<=rule.value,'<':actual<rule.value,'==':actual===rule.value}[rule.operator];}
 function resolve(node,options={}){
  if(!node.compose)return node;const n={...node,props:{...node.props},layout:{...node.layout},children:node.children},m=node.compose,mode=options.composeTheme||'dark',styles={};
  for(const [key,binding] of Object.entries(m.styles||{})){
   const prop=binding.property||key,changed=prop in node.props&&node.props[prop]!==m.base_props?.[prop];
   const themeRole=binding.expression?.match(/^MaterialTheme\.colorScheme\.(\w+)$/)?.[1];styles[key]=changed?node.props[prop]:binding.override?binding.value:(themeRole&&options.composeThemes?.[mode]?.[themeRole])??binding.by_mode?.[mode]??binding.value;
   if(prop in n.props&&!changed&&styles[key]!=null&&typeof styles[key]===typeof n.props[prop])n.props[prop]=styles[key];
  }
  const colors=styles.materialColors||{};if(colors.containerColor&&node.props.background===m.base_props?.background)n.props.background=colors.containerColor;
  if(m.conditional&&m.conditional.rule){const branch=test(m.conditional.rule,options.constraintWidth??options.width??390,options.constraintHeight??options.height??844);n.children=node.children[branch?0:1]?[node.children[branch?0:1]]:[];}
  n._composeStyles=styles;return n;
 }
 const color=v=>typeof v==='string'&&/^#[0-9a-f]{8}$/i.test(v)?'#'+v.slice(3)+v.slice(1,3):v;
 function apply(element,n,options={}){
  const meta=n.compose;if(!meta)return;const s=n._composeStyles||{},scale=options.fontScale||1;
  element.dataset.composeSource=meta.source?.path||'';element.dataset.logicalUnits='dp';element.dataset.cssPixelsPerDp='1';
  if(meta.placeholder){element.replaceChildren();element.textContent=meta.placeholder;element.classList.add('ad-compose-placeholder');}
  if(s.background&&!meta.styles?.background?.from_modifier)element.style.background=color(s.background);
  if(s.color)element.style.color=color(s.color);
  if(s.contentColor)element.style.color=color(s.contentColor);
  const colors=s.materialColors||{};if(colors.contentColor)element.style.color=color(colors.contentColor);
  if(n.props.enabled===false){if(colors.disabledContainerColor)element.style.background=color(colors.disabledContainerColor);if(colors.disabledContentColor)element.style.color=color(colors.disabledContentColor);}
  if(s.radius!=null&&!meta.styles?.radius?.from_modifier)element.style.borderRadius=s.shape?.percent&&s.radius===50?'9999px':s.radius+'px';
  if(meta.conditional||meta.branch){element.style.display='contents';return;}
  if(n.type==='Card'&&n.props.variant!=='outlined')Object.assign(element.style,{border:'none',minHeight:'0'});
  if(n.type==='Button')Object.assign(element.style,{padding:'10px 24px',minHeight:'40px'});
  if(n.type==='TextField'){
   const foreground=colors.unfocusedTextColor||colors.focusedTextColor||s.contentColor||'inherit';element.style.color=color(colors.unfocusedLabelColor||foreground);
   const row=element.querySelector('.ui-field-row');if(row){row.style.borderColor=color(colors.unfocusedBorderColor)||'currentColor';row.style.borderRadius=s.radius+'px';}
   for(const input of element.querySelectorAll('input')){
    Object.assign(input.style,{color:color(foreground),background:'transparent',caretColor:color(colors.cursorColor)||'auto'});
    const label=element.querySelector('.ui-field-label'),outlined=n.props.variant==='outlined';
    const refresh=()=>{const focused=document.activeElement===input,float=focused||!!input.value;
     if(row)row.style.borderColor=color(focused?colors.focusedBorderColor:colors.unfocusedBorderColor)||'currentColor';
     if(label&&outlined){Object.assign(label.style,{position:'absolute',zIndex:1,left:'12px',top:float?'0':'50%',transform:'translateY(-50%)',fontSize:(float?12:16)*scale+'px',lineHeight:'1.2',padding:'0 4px',pointerEvents:'none',color:color(focused?colors.focusedLabelColor:colors.unfocusedLabelColor)||'inherit'});input.placeholder=float?n.props.placeholder:'';let parent=element.parentElement;while(parent){const background=getComputedStyle(parent).backgroundColor;if(background!=='rgba(0, 0, 0, 0)'&&background!=='transparent'){label.style.backgroundColor=float?background:'transparent';break;}parent=parent.parentElement;}}
    };
    if(outlined&&row){Object.assign(row.style,{minHeight:'56px',padding:'12px 16px'});element.style.position='relative';}
    for(const button of element.querySelectorAll('button'))Object.assign(button.style,{border:'0',background:'transparent',color:color(colors.cursorColor)||'inherit',font:'inherit'});
    input.onfocus=refresh;input.onblur=refresh;input.addEventListener('input',refresh);requestAnimationFrame(refresh);
   }
  }
  if(n.type==='TextLabel'){
   Object.assign(element.style,{minWidth:'0',flexShrink:'0',wordBreak:'normal',overflowWrap:'normal',lineHeight:s.lineHeight!=null?s.lineHeight*scale+'px':'normal',letterSpacing:s.letterSpacing!=null?s.letterSpacing*scale+'px':'normal',fontStyle:s.fontStyle==='FontStyle.Italic'?'italic':'normal',textDecoration:s.textDecoration==='TextDecoration.Underline'?'underline':s.textDecoration==='TextDecoration.LineThrough'?'line-through':'none'});
   if(s.softWrap===false)element.style.whiteSpace='pre';
   if(s.fontWeight)element.style.fontWeight=({'Thin':100,'ExtraLight':200,'Light':300,'Normal':400,'Medium':500,'SemiBold':600,'Bold':700,'ExtraBold':800,'Black':900})[String(s.fontWeight).split('.').pop()]||400;
   if(s.fontFamily){const font=s.fontFamily,fontSource=typeof font==='object'?(options.composeFonts?.[font.font]||font.source):null,family=typeof font==='object'?font.font+'_'+(font.fingerprint||'local'):({SansSerif:'sans-serif',Serif:'serif',Monospace:'monospace',Cursive:'cursive',Default:'sans-serif'}[String(font).split('.').pop()]||'sans-serif');element.style.fontFamily=/^[\w -]+$/.test(family)?family:'sans-serif';if(typeof font==='object'&&/^[a-z0-9_]+$/.test(font.font)&&/^data:font\/(ttf|otf);base64,[A-Za-z0-9+/=]+$/.test(fontSource)&&!fontLoads.has(fontSource)){const face=new FontFace(family,`url(${fontSource})`);fontLoads.set(fontSource,face.load().then(loaded=>document.fonts.add(loaded)).catch(()=>{element.dataset.fontUnavailable='true';element.title='Fonte local inválida/indisponível; métricas de fallback.';}));}}
  }
  if(n.type==='Column')for(const e of element.children)if(e.dataset.nodeId)e.style.flexShrink='0';
  if(n.type==='Row'){
   element.style.minWidth='0';for(const e of element.children)if(e.dataset.nodeId)e.style.flexShrink='0';
   requestAnimationFrame(()=>{if(!element.isConnected)return;const content=element.querySelector(`[data-compose-owner="${n.id}"]`)||element,css=getComputedStyle(content);let remaining=content.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);for(const e of [...content.children].filter(e=>e.dataset.nodeId)){const child=n.children.find(c=>c.id===e.dataset.nodeId);if(child?.layout.weight)continue;e.style.maxWidth=Math.max(0,remaining)+'px';remaining-=e.offsetWidth+n.layout.gap;}});
  }
  const ops=meta.modifiers||[];
  if(ops.length&&n.type!=='ConstraintLayout'){
   const leaf=element.cloneNode(false);leaf.removeAttribute('data-node-id');leaf.removeAttribute('data-type');leaf.classList.remove('ui-node','ui-selected');leaf.classList.add('ad-compose-content');leaf.dataset.composeOwner=n.id;while(element.firstChild)leaf.append(element.firstChild);
   const dimensionOps=ops.some(o=>['width','height','size','fillMaxWidth','fillMaxHeight','fillMaxSize'].includes(o.type));
   Object.assign(element.style,{display:'block',padding:'0',gap:'0',border:'none',background:'transparent',borderRadius:'0',boxShadow:'none',minWidth:'0'});
   const firstHeight=ops.find(o=>['fillMaxSize','fillMaxHeight','height','size'].includes(o.type)),firstWidth=ops.find(o=>['fillMaxSize','fillMaxWidth','width','size'].includes(o.type));
   if(dimensionOps){element.style.height=firstHeight&&['fillMaxSize','fillMaxHeight'].includes(firstHeight.type)?'100%':'auto';element.style.width=firstWidth&&['fillMaxSize','fillMaxWidth'].includes(firstWidth.type)?'100%':'fit-content';}
   Object.assign(leaf.style,{width:'100%',height:'auto',padding:'0',margin:'0',minWidth:'0',minHeight:n.type==='Button'?'36px':'0',maxWidth:'none',maxHeight:'none'});
   let parent=element,fillHeight=!!firstHeight&&['fillMaxSize','fillMaxHeight'].includes(firstHeight.type);
   for(const op of ops){const values=op.values||[],a=op.named||{},value=values[0],wrapper=document.createElement('div');wrapper.className='ad-compose-modifier';wrapper.dataset.modifier=op.type;Object.assign(wrapper.style,{boxSizing:'border-box',width:'100%',height:fillHeight?'100%':'auto'});
    if(op.type==='padding'){
     const p=Number(value)||0;wrapper.style.padding=(a.top??a.vertical??p)+'px '+(a.end??a.horizontal??p)+'px '+(a.bottom??a.vertical??p)+'px '+(a.start??a.horizontal??p)+'px';
    }else if(['width','height'].includes(op.type)&&typeof (value??a[op.type])==='number'){wrapper.style[op.type]=(value??a[op.type])+'px';if(op.type==='height')fillHeight=true;}
    else if(['widthIn','heightIn'].includes(op.type)){const title=op.type==='widthIn'?'Width':'Height';if(typeof a.min==='number')wrapper.style['min'+title]=a.min+'px';if(typeof a.max==='number')wrapper.style['max'+title]=a.max+'px';}
    else if(op.type==='verticalScroll'||op.type==='horizontalScroll'){wrapper.style.overflow=op.type==='verticalScroll'?'hidden auto':'auto hidden';wrapper.style.maxHeight=op.type==='verticalScroll'?'100%':'none';}
    else if(op.type==='size'&&typeof value==='number'){wrapper.style.width=value+'px';wrapper.style.height=(values[1]??value)+'px';fillHeight=true;}
    else if(op.type==='fillMaxWidth')wrapper.style.width=typeof value==='number'?value*100+'%':'100%';
    else if(['fillMaxHeight','fillMaxSize'].includes(op.type)){wrapper.style.height=typeof value==='number'?value*100+'%':'100%';fillHeight=true;}
    else if(op.type==='background'){const background=meta.styles?.background?.override?meta.styles.background.value:a.color??value;wrapper.style.background=background?.gradient?`linear-gradient(${background.gradient==='verticalGradient'?'to bottom':background.gradient==='horizontalGradient'?'to right':'135deg'},${background.colors.map(color).join(',')})`:color(background)||'transparent';const shape=a.shape??values[1];const binding=meta.styles?.modifierRadius||meta.styles?.radius;if(shape?.radius!=null)wrapper.style.borderRadius=(binding?.from_modifier&&binding.override?binding.value:shape.radius)+'px';}
    else if(op.type==='clip'){const shape=value??a.shape;if(shape?.radius!=null){wrapper.style.borderRadius=shape.radius+'px';wrapper.style.overflow='hidden';}}
    else if(op.type==='alpha'&&typeof value==='number')wrapper.style.opacity=value;
    else if(op.type==='offset')wrapper.style.transform=`translate(${a.x??value??0}px,${a.y??values[1]??0}px)`;
    else if(op.type==='border'){wrapper.style.border=`${a.width??value??1}px solid ${color(a.color??values[1])||'currentColor'}`;const shape=a.shape??values[2];const binding=meta.styles?.modifierRadius||meta.styles?.radius;if(shape?.radius!=null)wrapper.style.borderRadius=(binding?.from_modifier&&binding.override?binding.value:shape.radius)+'px';}
    else if(op.type==='zIndex'&&typeof value==='number')element.style.zIndex=value;
    parent.append(wrapper);parent=wrapper;
   }
   if(ops.some(o=>o.type==='widthIn'))element.style.width='100%';
   if(fillHeight)leaf.style.height='100%';if(n.type==='Button')leaf.style.padding='10px 24px';parent.append(leaf);
   // Inspector changes override the imported chain only for this instance.
   for(const key of ['width','height','padding'])if(n.layout[key]!==meta.base_layout?.[key])element.style[key]=typeof n.layout[key]==='number'?n.layout[key]+'px':n.layout[key]==='fill'?'100%':'fit-content';
  }
  if(Object.values(meta.styles||{}).some(v=>v.status==='Dynamic')){element.dataset.composeDynamic='true';element.title='Estilo dinâmico preservado na fonte; consulte a origem no Inspector.';}
 }
 function inspector(host,node,field,transact,document,render){
  if(!node.compose)return;const details=documentElement('details'),summary=documentElement('summary');summary.textContent='Compose · Theme & Source';details.open=true;details.append(summary);
  const source=documentElement('p');source.textContent=`${node.compose.source?.path||''}:${node.compose.source?.line||''} · ${node.compose.source?.function||node.name}`;details.append(source);
  for(const [key,b] of Object.entries(node.compose.styles||{})){const row=documentElement('p');row.textContent=`${key}: ${JSON.stringify(b.value)} · ${b.status} · ${b.expression}`;row.title=JSON.stringify({callSite:b.source,definition:b.resolution_source});details.append(row);}
  if(node.compose.modifiers?.length){const chain=documentElement('ol');for(const op of node.compose.modifiers){const li=documentElement('li');li.textContent=op.type+' · '+op.category+' · '+op.status;
    if(op.values?.length)field(li,'Valores '+op.type,op.values,value=>{op.values=value;if(op.type==='background'&&node.compose.styles.background?.from_modifier){const b=node.compose.styles.background;b.value=value[0];b.by_mode={light:value[0],dark:value[0]};b.override=false;}});
    if(Object.keys(op.named||{}).length)field(li,'Argumentos '+op.type,op.named,value=>op.named=value);chain.append(li);}details.append(chain);}
  const advanced=node.compose.styles||{};for(const key of ['background','contentColor','lineHeight','letterSpacing','fontWeight','fontFamily','radius','opacity']){if(key in node.props)continue;const current=advanced[key]?.value;if(['number','string'].includes(typeof current))field(details,key,current,value=>{node.compose.styles[key]={...advanced[key],value,by_mode:{light:value,dark:value},status:'Fully supported',override:true};});}
  host.append(details);
 }
 function documentElement(tag){return document.createElement(tag);}
 return {resolve,apply,test,inspector};
})();
