/* Home Agata: visual Picadeiro Pop com operações reais na Bridge. */
(() => {
 "use strict";
 const root=document.getElementById("agata-home");
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
   if(typeof fn!=="function")throw Error("Abra o Agata pelo Vela para acessar seus projetos locais.");
   return await fn(...args);
 }
 function error(msg){q("agata-error").hidden=!msg;q("agata-error").textContent=msg||"";}
 function navigate(page){
   section=page;
   q("agata-dashboard").hidden=page!=="home";
   q("agata-templates").hidden=page!=="templates";
   q("agata-projects").hidden=page==="templates";
   q("agata-projects-title").textContent=page==="projects"?"Todos os projetos":"Recentes";
   q("agata-view-all").hidden=page!=="home";
   root.querySelectorAll("[data-section]").forEach(btn=>{
     const active=btn.dataset.section===page;
     btn.classList.toggle("active",active);
     if(active)btn.setAttribute("aria-current","page");else btn.removeAttribute("aria-current");
   });
   render();
 }
 function projectCard(item){
   const b=document.createElement("button");b.type="button";
   b.className="agata-project-card";b.dataset.id=item.id;
   b.setAttribute("aria-label","Abrir projeto "+item.name);
   const preview=document.createElement("span");preview.className="agata-project-preview";
   const mini=document.createElement("span");mini.className="agata-mini-device";mini.textContent="☺";preview.append(mini);
   const name=document.createElement("strong");name.className="agata-project-name";name.textContent=item.name;
   const meta=document.createElement("span");meta.className="agata-project-meta";
   const type=document.createElement("span");
   const mode=item.editor_mode==="svg"?"SVG / Vetores":item.editor_mode==="drawing"?"Área de desenho":"Esboço";
   type.textContent=mode+" · "+item.canvas.width+" × "+item.canvas.height;
   const date=document.createElement("small");
   const at=Date.parse(item.updated_at);
   date.textContent=Number.isFinite(at)?new Date(at).toLocaleDateString("pt-BR"):"Projeto local";
   meta.append(type,date);b.append(preview,name,meta);return b;
 }
 function render(){
   const host=q("agata-project-list");host.replaceChildren();
   const items=section==="home"?projects.slice(0,4):projects;
   if(!items.length){
     const empty=document.createElement("div");empty.className="agata-empty";
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
   q("agata-create-form").reset();
   q("agata-name").value="";
   q("agata-mode").value=conf.mode;
   q("agata-platform").value=conf.platform;
   q("agata-width").value=conf.width;
   q("agata-height").value=conf.height;
   q("agata-form-error").hidden=true;
   q("agata-create-dialog").showModal();
   q("agata-name").focus();
 }
 async function create(event){
   event.preventDefault();const form=q("agata-create-form");
   if(!form.reportValidity())return;
   const btn=q("agata-confirm-create");
   btn.disabled=true;q("agata-form-error").hidden=true;
   try{
     const item=await api("create_project",{
       name:q("agata-name").value.trim(),editor_mode:q("agata-mode").value,
       platform:q("agata-platform").value,
       width:Number(q("agata-width").value),height:Number(q("agata-height").value)
     });
     if(!item?.id)throw Error("O serviço não retornou o ID do projeto.");
     q("agata-create-dialog").close();
     await window.Vela.navigate("/sketch",{project_id:item.id});
   }catch(e){q("agata-form-error").textContent=e.message;q("agata-form-error").hidden=false;}
   finally{if(!disposed)btn.disabled=false;}
 }
 on(q("agata-create"),"click",()=>openCreate());
 on(q("agata-view-all"),"click",()=>navigate("projects"));
 on(q("agata-create-form"),"submit",create);
 on(q("agata-close-create"),"click",()=>q("agata-create-dialog").close());
 on(q("agata-cancel-create"),"click",()=>q("agata-create-dialog").close());
 on(q("agata-project-list"),"click",event=>{
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
