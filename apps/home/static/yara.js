/* Home Yara: visual Picadeiro Pop com operações reais na Bridge. */
(() => {
 "use strict";
 const root=document.getElementById("yara-home");
 if(!root || root.dataset.mounted)return;
 root.dataset.mounted="1";
 const q=id=>root.querySelector("#"+id);
 const abort=new AbortController();
 const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
 let section="home",projects=[],disposed=false;
 const preset={
   android:{platform:"android",width:390,height:844,mode:"sketch"},
   web:{platform:"web",width:1280,height:800,mode:"drawing"},
   svg:{platform:"desktop",width:512,height:512,mode:"svg"},
   tablet:{platform:"android",width:768,height:1024,mode:"sketch"},
   sketch:{platform:"android",width:390,height:844,mode:"sketch"},
   drawing:{platform:"desktop",width:1280,height:800,mode:"drawing"}
 };
 async function api(name,...args){
   const fn=window.pywebview?.api?.[name];
   if(typeof fn!=="function")throw Error("Abra o Yara pelo Vela para acessar seus projetos locais.");
   return await fn(...args);
 }
 function error(msg){q("yara-error").hidden=!msg;q("yara-error").textContent=msg||"";}
 function navigate(page){
   section=page;
   q("yara-dashboard").hidden=page!=="home";
   q("yara-templates").hidden=page!=="templates";
   q("yara-projects").hidden=page==="templates";
   q("yara-projects-title").textContent=page==="projects"?"Todos os projetos":"Recentes";
   q("yara-view-all").hidden=page!=="home";
   root.querySelectorAll("[data-section]").forEach(btn=>{
     const active=btn.dataset.section===page;
     btn.classList.toggle("active",active);
     if(active)btn.setAttribute("aria-current","page");else btn.removeAttribute("aria-current");
   });
   render();
 }
 function projectCard(item){
   const b=document.createElement("button");b.type="button";
   b.className="yara-project-card";b.dataset.id=item.id;
   b.setAttribute("aria-label","Abrir projeto "+item.name);
   const preview=document.createElement("span");preview.className="yara-project-preview";
   const mini=document.createElement("span");mini.className="yara-mini-device";mini.textContent="☺";preview.append(mini);
   const name=document.createElement("strong");name.className="yara-project-name";name.textContent=item.name;
   const meta=document.createElement("span");meta.className="yara-project-meta";
   const type=document.createElement("span");
   const mode=item.editor_mode==="svg"?"SVG / Vetores":item.editor_mode==="drawing"?"Área de desenho":"Esboço";
   type.textContent=mode+" · "+item.canvas.width+" × "+item.canvas.height;
   const date=document.createElement("small");
   const at=Date.parse(item.updated_at);
   date.textContent=Number.isFinite(at)?new Date(at).toLocaleDateString("pt-BR"):"Projeto local";
   meta.append(type,date);b.append(preview,name,meta);return b;
 }
 function render(){
   const host=q("yara-project-list");host.replaceChildren();
   const items=section==="home"?projects.slice(0,4):projects;
   if(!items.length){
     const empty=document.createElement("div");empty.className="yara-empty";
     const strong=document.createElement("strong");strong.textContent="Seu primeiro projeto começa aqui.";
     const action=document.createElement("button");action.type="button";action.textContent="＋ Criar agora";
     on(action,"click",()=>openCreate());empty.append(strong,action);host.append(empty);return;
   }
   items.forEach(item=>host.append(projectCard(item)));
 }
 async function refresh(){
   try{
     const result=await api("list_projects");
     if(!Array.isArray(result))throw Error("Lista de projetos inválida.");
     if(disposed)return;
     projects=result;error("");render();
   }catch(e){if(!disposed)error(e.message);}
 }
 function openCreate(kind="android"){
   const conf=preset[kind]||preset.android;
   q("yara-create-form").reset();
   q("yara-name").value="";
   q("yara-mode").value=conf.mode;
   q("yara-platform").value=conf.platform;
   q("yara-width").value=conf.width;
   q("yara-height").value=conf.height;
   q("yara-form-error").hidden=true;
   q("yara-create-dialog").showModal();
   q("yara-name").focus();
 }
 async function create(event){
   event.preventDefault();const form=q("yara-create-form");
   if(!form.reportValidity())return;
   const btn=q("yara-confirm-create");
   btn.disabled=true;q("yara-form-error").hidden=true;
   try{
     const item=await api("create_project",{
       name:q("yara-name").value.trim(),editor_mode:q("yara-mode").value,
       platform:q("yara-platform").value,
       width:Number(q("yara-width").value),height:Number(q("yara-height").value)
     });
     if(!item?.id)throw Error("O serviço não retornou o ID do projeto.");
     q("yara-create-dialog").close();
     await window.Vela.navigate("/sketch",{project_id:item.id});
   }catch(e){q("yara-form-error").textContent=e.message;q("yara-form-error").hidden=false;}
   finally{if(!disposed)btn.disabled=false;}
 }
 on(q("yara-create"),"click",()=>openCreate());
 on(q("yara-view-all"),"click",()=>navigate("projects"));
 on(q("yara-create-form"),"submit",create);
 on(q("yara-close-create"),"click",()=>q("yara-create-dialog").close());
 on(q("yara-cancel-create"),"click",()=>q("yara-create-dialog").close());
 on(q("yara-project-list"),"click",event=>{
   const btn=event.target.closest("[data-id]");
   if(btn)window.Vela.navigate("/sketch",{project_id:btn.dataset.id});
 });
 for(const btn of root.querySelectorAll("[data-section]"))
   on(btn,"click",()=>navigate(btn.dataset.section));
 for(const btn of root.querySelectorAll("[data-editor-mode]"))
   on(btn,"click",()=>openCreate(btn.dataset.editorMode));
 for(const btn of root.querySelectorAll("[data-preset]"))
   on(btn,"click",()=>openCreate(btn.dataset.preset));
 const previous=window.VelaPage?.beforeUnmount;
 window.VelaPage={...(window.VelaPage||{}),beforeUnmount(){
   disposed=true;abort.abort();if(typeof previous==="function")previous.call(this);
 }};
 navigate(root.dataset.homeStart || "home");
 if(root.dataset.create==="1")openCreate();
 refresh();
})();
