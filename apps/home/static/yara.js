/* Home do Yara: bridge Python é a fonte única dos projetos persistidos. */
(() => {
  const root = document.getElementById("yara-home");
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = "1";
  const get = id => root.querySelector("#" + id);
  const abort = new AbortController();
  let disposed = false;
  let projects = [], section = "home";
  const on = (element, name, fn) => element.addEventListener(name, fn, {signal:abort.signal});

  function showError(message) {
    get("yara-error").textContent = message || "";
    get("yara-error").hidden = !message;
  }

  async function bridge(method, ...args) {
    const fn = window.pywebview?.api?.[method];
    if (typeof fn !== "function") throw new Error("Abra o Yara pelo Vela para trabalhar com projetos locais.");
    return await fn(...args);
  }

  function navigate(page) {
    section = page;
    const home = page === "home";
    get("yara-dashboard").hidden = !home;
    get("yara-crumb").textContent = home ? "Início" : "Projetos";
    get("yara-projects-title").textContent = home ? "Projetos recentes" : "Todos os projetos";
    get("yara-view-all").hidden = !home;
    root.querySelectorAll("[data-section]").forEach(btn => {
      const active = btn.dataset.section === page;
      btn.classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    renderProjects();
  }

  function preview() {
    const holder = document.createElement("span"); holder.className="yara-project-preview";
    const phone=document.createElement("span"); phone.className="yara-mini-device";
    for(let i=0;i<3;i++) phone.appendChild(document.createElement("i"));
    holder.appendChild(phone); return holder;
  }

  function renderProjects() {
    const list=get("yara-project-list"); list.replaceChildren();
    const visible=section==="home"?projects.slice(0,3):projects;
    if(!visible.length){
      const box=document.createElement("div");box.className="yara-empty";
      const title=document.createElement("strong");title.textContent="Seu primeiro projeto começa aqui.";
      const desc=document.createElement("span");desc.textContent="Crie um esboço para vê-lo nesta área.";
      box.append(title,desc);list.appendChild(box);return;
    }
    for(const project of visible){
      const button=document.createElement("button");button.type="button";button.className="yara-project-card";
      button.dataset.projectId=project.id;
      button.setAttribute("aria-label","Abrir detalhes de "+project.name);
      const name=document.createElement("strong");name.textContent=project.name;
      const meta=document.createElement("small");meta.textContent=project.platform+" · "+project.canvas.width+" × "+project.canvas.height+" px";
      button.append(preview(),name,meta);list.appendChild(button);
    }
  }

  async function refresh() {
    try {
      const result=await bridge("list_projects");
      if(!Array.isArray(result)) throw new Error("Resposta inválida do serviço de projetos.");
      if(disposed)return;
      projects=result;showError("");renderProjects();
    }catch(e){if(!disposed){projects=[];renderProjects();showError(e.message);}}
  }

  function openCreate() {
    get("yara-create-form").reset();
    get("yara-form-error").hidden=true;
    get("yara-create-dialog").showModal();
    get("yara-name").focus();
  }

  async function saveNewProject(event){
    event.preventDefault();
    const form=get("yara-create-form");if(!form.reportValidity())return;
    const button=get("yara-confirm-create"),message=get("yara-form-error");
    button.disabled=true;message.hidden=true;
    try {
      await bridge("create_project",{
        name:get("yara-name").value.trim(),
        platform:get("yara-platform").value,
        width:Number(get("yara-width").value),
        height:Number(get("yara-height").value)
      });
      if(disposed)return;
      get("yara-create-dialog").close();navigate("projects");
      await refresh();
    }catch(e){if(!disposed){message.textContent=e.message;message.hidden=false;}}
    finally{if(!disposed)button.disabled=false;}
  }

  function detailRow(label,value){
    const row=document.createElement("p");
    const heading=document.createElement("span");heading.textContent=label;
    const data=document.createElement("strong");data.textContent=String(value);
    row.append(heading,data);return row;
  }

  async function openDetails(id){
    try{
      const project=await bridge("get_project",id);
      if(disposed)return;
      get("yara-details-title").textContent=project.name;
      get("yara-details").replaceChildren(
        detailRow("Tipo","Esboço"),
        detailRow("Plataforma",project.platform),
        detailRow("Prancheta",project.canvas.width+" × "+project.canvas.height+" px"),
        detailRow("Telas",project.screens.length)
      );
      get("yara-details-dialog").showModal();
    }catch(e){if(!disposed)showError("Erro ao carregar projeto: "+e.message);}
  }

  on(get("yara-create"),"click",openCreate);
  on(get("yara-create-sketch"),"click",openCreate);
  on(get("yara-close-create"),"click",()=>get("yara-create-dialog").close());
  on(get("yara-cancel-create"),"click",()=>get("yara-create-dialog").close());
  on(get("yara-create-form"),"submit",saveNewProject);
  on(get("yara-view-all"),"click",()=>navigate("projects"));
  on(get("yara-close-details"),"click",()=>get("yara-details-dialog").close());
  on(get("yara-done-details"),"click",()=>get("yara-details-dialog").close());
  on(get("yara-project-list"),"click",event=>{
    const target=event.target.closest("[data-project-id]");
    if(target)openDetails(target.dataset.projectId);
  });
  root.querySelectorAll("[data-section]").forEach(node=>on(node,"click",()=>navigate(node.dataset.section)));

  const page=window.VelaPage||{};
  const prior=page.beforeUnmount;
  page.beforeUnmount=function(){
    disposed=true;abort.abort();
    if(typeof prior==="function")prior.call(this);
  };
  window.VelaPage=page;
  refresh();
})();
