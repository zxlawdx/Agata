/* Visual template gallery driven by the actual editable template registry. */
(() => {
 "use strict";
 const root=document.getElementById("agata-home");
 if(!root||root.dataset.galleryMounted)return;
 root.dataset.galleryMounted="1";
 const q=id=>root.querySelector("#"+id),abort=new AbortController();
 const on=(node,event,handler)=>node?.addEventListener(event,handler,{signal:abort.signal});
 const grid=q("agata-gallery-grid"),dialog=q("agata-gallery-dialog");
 const cache=new Map();
 let items=[],loaded=false,loading=null,selected=null,observer=null,screenIndex=0,screenCount=0,modalVersion=0;
 const api=(method,...args)=>{
  const fn=window.pywebview?.api?.[method];
  if(typeof fn!=="function")return Promise.reject(Error("Bridge Vela indisponível."));
  return fn(...args);
 };
 const status=text=>{q("agata-gallery-status").textContent=text;};
 const text=(tag,value,className)=>{
  const el=document.createElement(tag);el.textContent=String(value);
  if(className)el.className=className;
  return el;
 };
 const key=(item,index=0)=>item.platform+":"+item.id+":"+index;
 const title=item=>item.platform==="web"?"Web · HTML/CSS/JS":"Android · Compose/XML";
 const detail=item=>item.name+" · "+item.category+" · "+(item.theme==="dark"?"Dark":"Light")+" · v"+item.version+" · licença "+item.license;
 const markError=(container,error)=>{
  container.replaceChildren(text("p","Prévia indisponível: "+(error.message||error),"agata-gallery-error"));
 };
 async function preview(item,index=0){
  const id=key(item,index);
  if(!cache.has(id)){
   cache.set(id,api("template_gallery_preview",item.id,item.platform,index).catch(error=>{
    cache.delete(id);throw error;
   }));
  }
  return cache.get(id);
 }
 async function hydrate(item,frame,host){
  try{
   const sample=await preview(item);
   if(!root.isConnected||!frame.isConnected)return;
   frame.srcdoc=sample.html;
   frame.title="Miniatura do modelo "+item.name;
   host.dataset.rendered=sample.kind;
   host.setAttribute("aria-busy","false");
  }catch(e){
   host.setAttribute("aria-busy","false");markError(host,e);
  }
 }
 function card(item){
  const article=document.createElement("article");article.className="agata-template-card";
  article.dataset.templateId=item.id;article.dataset.platform=item.platform;
  const thumb=document.createElement("div");thumb.className="agata-template-thumb "+(item.platform==="android"?"agata-template-phone":"agata-template-browser");
  thumb.setAttribute("aria-busy","true");
  const frame=document.createElement("iframe");
  frame.tabIndex=-1;frame.setAttribute("aria-hidden","true");frame.setAttribute("sandbox","");
  frame.setAttribute("referrerpolicy","no-referrer");frame.loading="lazy";
  thumb.append(frame);
  const meta=document.createElement("div");meta.className="agata-template-meta";
  meta.append(text("small",title(item)),text("h3",item.name),text("p",item.category+" · "+(item.theme==="dark"?"Dark":"Light")+" · "+item.tags.join(" · ")));
  const line=document.createElement("div");line.className="agata-template-attribution";
  line.append(text("span",item.author||"Agata Studio"),text("span",item.license+" · "+item.version));
  meta.append(line);
  const actions=document.createElement("div");actions.className="agata-template-actions";
  const show=text("button","Prévia");show.type="button";show.dataset.galleryAction="preview";
  show.setAttribute("aria-label","Prévia de "+item.name);
  const use=text("button","Usar modelo ✦");use.type="button";use.dataset.galleryAction="use";
  use.setAttribute("aria-label","Criar projeto usando "+item.name);
  actions.append(show,use);article.append(thumb,meta,actions);
  if(observer)observer.observe(article);
  else hydrate(item,frame,thumb);
  return article;
 }
 function render(){
  if(!loaded)return;
  const platform=q("agata-template-platform").value;
  const category=q("agata-template-category").value;
  const theme=q("agata-template-theme").value;
  const query=q("agata-template-search").value.trim().toLocaleLowerCase("pt-BR");
  const filtered=items.filter(item=>(platform==="all"||item.platform===platform)
   &&(category==="all"||item.category===category)
   &&(theme==="all"||item.theme===theme)
   &&(item.name+" "+item.category+" "+item.tags.join(" ")).toLocaleLowerCase("pt-BR").includes(query));
  observer?.disconnect();
  grid.replaceChildren(...filtered.map(card));
  if(!filtered.length)grid.append(text("p","Nenhum template encontrado. Altere os filtros para continuar.","agata-gallery-empty"));
  status(filtered.length+" modelos exibidos · "+items.length+" disponíveis.");
 }
 async function load(){
  if(loaded)return render();
  if(loading)return loading;
  status("Preparando a galeria de projetos editáveis…");
  loading=api("template_gallery_catalog").then(result=>{
   if(!Array.isArray(result))throw Error("Catálogo de templates inválido");
   items=result.filter(t=>t && ["android","web"].includes(t.platform));
   const cats=[...new Set(items.map(i=>i.category))].sort();
   q("agata-template-category").replaceChildren(new Option("Todas as categorias","all"),
    ...cats.map(value=>new Option(value,value)));
   loaded=true;render();
  }).catch(e=>{status("Não foi possível carregar modelos: "+e.message);
   grid.replaceChildren();
   const retry=text("button","Tentar novamente");retry.type="button";on(retry,"click",()=>{loading=null;load();});
   grid.append(retry);
  }).finally(()=>{loading=null;});
  return loading;
 }
 function use(item){
  dialog.close();
  const open=window.AgataOpenTemplate;
  if(typeof open!=="function"){status("Assistente de projetos indisponível.");return;}
  open(item.platform,item.id);
 }
 function previewDevice(){
  const mobile=q("agata-gallery-device").value==="mobile";
  const frame=q("agata-gallery-frame");
  frame.style.width=mobile?"min(390px,100%)":"100%";
  frame.style.marginInline="auto";
  q("agata-gallery-device-label").title=mobile?"Largura lógica 390px, prévia estática e isolada":"Prévia responsiva na largura disponível";
 }
 async function renderModal(item,index=0){
  const version=++modalVersion;
  q("agata-gallery-prev").disabled=true;
  q("agata-gallery-next").disabled=true;
  q("agata-gallery-counter").textContent="Carregando tela…";
  try{
   const data=await preview(item,index);
   if(version!==modalVersion||!dialog.open||selected!==item)return;
   screenCount=data.screens||1;
   screenIndex=index;
   q("agata-gallery-frame").srcdoc=data.html;
   q("agata-gallery-counter").textContent=(data.screen_name||"Tela")+" · "+(index+1)+"/"+screenCount;
   q("agata-gallery-prev").disabled=index===0;
   q("agata-gallery-next").disabled=index>=screenCount-1;
  }catch(e){if(version===modalVersion&&dialog.open)q("agata-gallery-counter").textContent=e.message;}
 }
 async function show(item){
  selected=item;screenIndex=0;screenCount=0;
  q("agata-gallery-title").textContent=item.name;
  q("agata-gallery-detail").textContent=detail(item);
  q("agata-gallery-limit").textContent=item.platform==="android"?"Prévia esquemática de telas editáveis; confirme o resultado no Android Studio.":"Prévia responsiva HTML/CSS, sem scripts; interatividade apenas no projeto.";
  q("agata-gallery-screens").hidden=item.platform!=="android";
  q("agata-gallery-device-label").hidden=item.platform!=="web";
  q("agata-gallery-device").value="desktop";previewDevice();
  q("agata-gallery-frame").removeAttribute("srcdoc");
  dialog.showModal();
  await renderModal(item,0);
 }
 if("IntersectionObserver" in window){
  observer=new IntersectionObserver(records=>{
   for(const entry of records)if(entry.isIntersecting){
    observer.unobserve(entry.target);
    const item=items.find(x=>x.id===entry.target.dataset.templateId&&x.platform===entry.target.dataset.platform);
    if(item)hydrate(item,entry.target.querySelector("iframe"),entry.target.querySelector(".agata-template-thumb"));
   }
  },{root:q("agata-templates"),rootMargin:"240px"});
 }
 on(grid,"click",event=>{
  const button=event.target.closest("[data-gallery-action]"),
   article=button?.closest("[data-template-id]");
  if(!article)return;
  const item=items.find(x=>x.id===article.dataset.templateId&&x.platform===article.dataset.platform);
  if(!item)return;
  if(button.dataset.galleryAction==="use")use(item);
  else show(item);
 });
 on(q("agata-template-search"),"input",render);
 on(q("agata-template-platform"),"change",render);
 on(q("agata-template-category"),"change",render);
 on(q("agata-template-theme"),"change",render);
 on(q("agata-gallery-use"),"click",()=>{if(selected)use(selected);});
 on(q("agata-gallery-prev"),"click",()=>{if(selected&&screenIndex>0)renderModal(selected,screenIndex-1);});
 on(q("agata-gallery-next"),"click",()=>{if(selected&&screenIndex<screenCount-1)renderModal(selected,screenIndex+1);});
 on(q("agata-gallery-device"),"change",previewDevice);
 on(q("agata-gallery-close"),"click",()=>dialog.close());
 on(dialog,"close",()=>{selected=null;modalVersion++;q("agata-gallery-frame").removeAttribute("srcdoc");});
 on(root,"agata:section-change",event=>{if(event.detail==="templates")load();});
 if(!q("agata-templates").hidden)load();
 const previous=window.VelaPage?.beforeUnmount;
 window.VelaPage={...(window.VelaPage||{}),beforeUnmount(){
  abort.abort();observer?.disconnect();if(previous)return previous.call(this);
 }};
})();
