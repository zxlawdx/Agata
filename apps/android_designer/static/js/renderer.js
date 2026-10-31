/* Render the same semantic tree in Design and interactive Preview. */
window.AgataUIRenderer=(()=>{
 const paths={menu:'M3 6H21M3 12H21M3 18H21',back:'M14 4L6 12L14 20M6 12H22',home:'M2 11L12 2L22 11M5 10V22H19V10',search:'M20 20L15 15M17 10A7 7 0 1 1 3 10A7 7 0 1 1 17 10',close:'M4 4L20 20M20 4L4 20',settings:'M12 2V22M2 12H22M5 5L19 19M19 5L5 19',plus:'M12 3V21M3 12H21'};
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 function icon(name){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('width','24');s.setAttribute('height','24');s.setAttribute('aria-hidden','true');const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',paths[name]||'');p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','2');s.append(p);return s;}
 function render(n,options={}){
  const aliases={Avatar:'Card',Chip:'Button',Badge:'TextLabel',ListItem:'Row',NavigationRail:'Region',TabRow:'Row'};if(aliases[n.type])return render({...n,type:aliases[n.type]},options);
  const p=n.props,l=window.AgataLayout.resolve(n.layout,options.width,options.height),preview=!!options.preview;
  const childOptions={...options,parentType:n.type,parentLayout:l};
  const e=el('div','ui-node ui-'+n.type);e.dataset.nodeId=n.id;e.dataset.type=n.type;e.style.fontSize=16*(options.fontScale||1)+'px';
  if(options.selected?.has(n.id))e.classList.add('ui-selected');
  e.style.padding=l.padding+'px';e.style.gap=l.gap+'px';e.style.boxSizing='border-box';
  for(const k of ['width','height'])e.style[k]=l[k]==='fill'?'100%':l[k]==='wrap'?'fit-content':l[k]+'px';
  if(l.weight)e.style.flex=l.weight+' 1 0';
  if(p.background)e.style.background=p.background;
  if(p.color)e.style.color=p.color;
  if(p.radius!==undefined)e.style.borderRadius=p.radius+'px';
  if(p.elevation)e.style.boxShadow=`0 ${p.elevation}px ${p.elevation*3}px #0003`;
  if(l.scroll!=='none'){e.style.overflow=l.scroll==='vertical'?'hidden auto':'auto hidden';}
  if(['Column','Row','Box','Card','Sidebar','TopBar','BottomBar','Button','NavigationItem','FloatingButton','IconButton','Surface','ScrollContainer','Grid'].includes(n.type)){
   e.style.display='flex';e.style.flexDirection=['Row','TopBar','BottomBar','Button','NavigationItem','FloatingButton','IconButton','Surface','ScrollContainer','Grid'].includes(n.type)?'row':'column';
   e.style.alignItems={start:'flex-start',center:'center',end:'flex-end'}[l.alignment];e.style.justifyContent={start:'flex-start',center:'center',end:'flex-end',spaceBetween:'space-between'}[l.arrangement];
  }
  if(['Shape','DrawingCanvas','Chart'].includes(n.type)){e.append(window.AgataGraphics.render(n,options));}
  else if(n.type==='TextLabel'){e.textContent=p.text;e.style.fontSize=p.fontSize+'px';e.style.fontWeight=p.bold?'700':'400';e.style.textAlign=p.align;e.style.whiteSpace='pre-wrap';e.style.overflowWrap='anywhere';}
  else if(n.type==='Icon'){if(p.icon!=='none')e.append(icon(p.icon));e.setAttribute('aria-label',p.description);}
  else if(n.type==='Divider'){e.style.background='#CCCCCC';}
  else if(n.type==='Image'){if(/^data:image\/png;base64,/.test(p.source)){const img=el('img');img.src=p.source;img.alt=p.description;img.style.maxWidth='100%';e.append(img);}else e.append(el('span','','Selecione uma imagem PNG no Inspector'));}
  else if(n.type==='TextField'||n.type==='SearchBar'){
   if(n.type==='TextField')e.append(el('label','ui-field-label',p.label));
   const row=el('div','ui-field-row');const input=el('input');input.type={password:'password',number:'number',email:'email',phone:'tel'}[p.keyboard]||'text';input.style.fontSize=16*(options.fontScale||1)+'px';input.value=options.state?.[n.id]??p.value;input.placeholder=p.placeholder;input.disabled=!p.enabled;
   input.readOnly=!preview;input.oninput=()=>{if(options.state)options.state[n.id]=input.value;};
   for(const c of n.children.filter(c=>c.role!=='trailing'))row.append(render(c,childOptions));row.append(input);
   if(n.type==='SearchBar'){
    const clear=el('button','','×');clear.type='button';clear.disabled=!p.enabled||!preview;clear.setAttribute('aria-label','Limpar pesquisa');clear.onclick=event=>{if(preview){event.stopPropagation();input.value='';if(options.state)options.state[n.id]='';}};row.append(clear);
   }
   for(const c of n.children.filter(c=>c.role==='trailing'))row.append(render(c,childOptions));if(p.keyboard==='password'){const toggle=el('button','','Mostrar');toggle.type='button';toggle.disabled=!preview;toggle.onclick=ev=>{ev.stopPropagation();input.type=input.type==='password'?'text':'password';toggle.textContent=input.type==='password'?'Mostrar':'Ocultar';};row.append(toggle);}e.append(row);
   if(p.error||p.helper)e.append(el('small',p.error?'ui-field-error':'',p.error||p.helper));
  }else if(n.type==='ProgressIndicator'){const progress=el('progress');progress.max=1;progress.value=p.value;progress.style.width='100%';progress.style.accentColor=p.color;progress.setAttribute('aria-label',n.name);e.append(progress);}
  else if(['Checkbox','Switch','Slider','RadioButton'].includes(n.type)){
   const control=el('input');control.type=n.type==='Slider'?'range':n.type==='RadioButton'?'radio':'checkbox';control.disabled=!p.enabled||!preview;
   if(n.type==='Slider'){control.min=p.min;control.max=p.max;control.value=options.state?.[n.id]??p.value;}
   else control.checked=options.state?.[n.id]??p.checked;
   control.oninput=()=>{if(options.state)options.state[n.id]=control.type==='range'?Number(control.value):control.checked;};e.append(control);
  }else for(const child of n.children)e.append(render(child,childOptions));
  if(n.type==='Region')e.style.flexDirection=p.orientation==='horizontal'?'row':'column';
  if(n.type==='Box'){e.style.display='grid';e.style.placeItems={start:'start',center:'center',end:'end'}[l.alignment];for(const child of e.children)child.style.gridArea='1 / 1';}
  if(['Button','NavigationItem','FloatingButton','IconButton'].includes(n.type)){
   e.setAttribute('role','button');e.setAttribute('aria-disabled',String(!p.enabled));e.tabIndex=preview&&p.enabled!==false?0:-1;
   e.dataset.variant=p.variant||'filled';if(!p.enabled)e.style.opacity='.45';
   if(p.selected||n.type==='NavigationItem'&&n.events.onClick?.target===options.activeScreen)e.classList.add('ui-item-selected');
  }
  e.addEventListener('click',event=>{
   if(!preview){event.preventDefault();event.stopPropagation();options.select?.(n.id,event.ctrlKey||event.metaKey);}
   else if(n.events.onClick&&p.enabled!==false){event.stopPropagation();options.action?.(n.events.onClick);}
  });
  e.addEventListener('keydown',event=>{if(preview&&p.enabled!==false&&['Enter',' '].includes(event.key)&&n.events.onClick){event.preventDefault();options.action?.(n.events.onClick);}});
  if(!preview&&n.type==='TextLabel')e.ondblclick=event=>{event.stopPropagation();options.editText?.(n);};
  if(options.validationErrors?.[n.id])e.append(el('small','ui-field-error',options.validationErrors[n.id]));
  window.AgataLayout.apply(e,n,options);
  if(n._layer){e.style.zIndex=n._layer.order;e.style.opacity=Number(e.style.opacity||1)*n._layer.opacity;}
  if(['Guideline','Barrier'].includes(n.type)){e.classList.add('ad-helper');if(preview)e.style.visibility='hidden';else e.title=n.name;}
  window.AgataConstraints.layout(e,{...n,layout:l,children:n.children.map(c=>({...c,layout:AgataLayout.resolve(c.layout,options.width,options.height)}))},options);
  if(!preview){const handle=el('span','ad-drag-handle');handle.dataset.dragNode=n.id;handle.title='Arrastar '+n.name;handle.setAttribute('aria-label','Arrastar '+n.name);e.append(handle);if(options.selected?.has(n.id)){const resize=el('span','ad-resize-handle');resize.dataset.resizeNode=n.id;resize.title='Redimensionar';e.append(resize);}}
  return e;
 }
 return {render,el,icon};
})();
