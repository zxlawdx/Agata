/* Editor de esboços do Agata: Fabric.js 5, Vela Bridge e modelo de camadas. */
(() => {
  "use strict";
  const C = () => window.AgataSketchCore;
  const F = () => window.fabric;
  const COMPONENTS = () => window.AgataSketchComponents;
  const TOOLS = ["select", "pen", "erase", "text", "rect", "ellipse", "triangle", "diamond", "line"];
  const SHAPES = new Set(["rect", "ellipse", "triangle", "diamond", "line"]);
  const HELP = {
    select: "Selecione, movimente ou redimensione apenas os objetos da camada ativa.",
    pen: "Desenhe e escreva à mão com sua mesa digitalizadora ou mouse.",
    erase: "Clique em um traço ou objeto da camada ativa para apagá-lo.",
    text: "Clique na prancheta para inserir texto editável.",
    rect: "Clique e arraste para desenhar um retângulo.",
    ellipse: "Clique e arraste para desenhar uma elipse.",
    triangle: "Clique e arraste para desenhar um triângulo vetorial.",
    diamond: "Clique e arraste para desenhar um losango vetorial.",
    line: "Clique e arraste para desenhar uma linha."
  };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const escapeError = e => e?.message || String(e);

  async function mount(root) {
    if (root.dataset.mounted === "1") return;
    root.dataset.mounted = "1";
    if (!F()?.Canvas || !C()) throw new Error("O motor de desenho não foi carregado.");
    const get = id => root.querySelector("#" + id);
    const api = window.pywebview?.api;
    if (!api?.get_project || !api?.save_sketch) throw new Error("A Bridge do Vela está indisponível.");
    const project = await api.get_project(root.dataset.projectId);
    if (!project?.canvas || !Array.isArray(project.screens) || !project.screens[0]) {
      throw new Error("Projeto de esboço incompatível.");
    }
    if (!root.isConnected) return;
    const width = project.canvas.width, height = project.canvas.height;
    const screen = project.screens[0];
    const state = C().upgrade(screen);
    const canvas = new (F().Canvas)("ys-canvas", {
      width, height, backgroundColor: "#ffffff", preserveObjectStacking: true,
      selection: true, enableRetinaScaling: true, renderOnAddRemove: false
    });
    let zoom = 1, tool = "select", drawing = null, isolated = null;
    let componentSession = null;
    let restoring = false, disposed = false, saving = false;
    const past = [], future = [];
    let savedSnapshot = "";
    const abort = new AbortController();
    const collapsedLayers = new Set();
    const E = () => window.AgataElementTree;
    const on = (element, event, callback) => element?.addEventListener(event, callback, {signal: abort.signal});
    const notifications=window.AgataNotifications.create(get("ys-message"));
    const message = (text,error=false) => notifications.show(text,{error});
    const alertError = error => message(escapeError(error), true);

    function serialize() {
      const layers = state.layers.map(layer => ({
        id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked, objects: []
      }));
      const lookup = new Map(layers.map(layer => [layer.id, layer]));
      for (const object of canvas.getObjects()) {
        const target = lookup.get(object.layerId);
        if (target) target.objects.push(object.toObject(["layerId", "componentKind", "componentId", "componentRole", "iconKind"]));
      }
      return {active_layer_id: state.activeLayerId, layers};
    }
    const snapshot = () => JSON.stringify(serialize());
    function updateDirty() {
      const changed = snapshot() !== savedSnapshot;
      get("ys-dirty-status").textContent = changed ? "● Alterações não salvas" : "✓ Salvo";
      get("ys-dirty-status").style.color = changed ? "#eec49a" : "#a2d6d5";
    }
    function updateHistoryButtons() {
      get("ys-undo").disabled = past.length <= 1;
      get("ys-redo").disabled = !future.length;
    }
    function commit() {
      // Enquanto o usuário edita partes, o histórico guarda o conjunto ao concluir.
      if (restoring || disposed || componentSession) {
        if (componentSession && !restoring) { renderProps(); updateDirty(); }
        return;
      }
      const current = snapshot();
      if (past.at(-1) !== current) {
        past.push(current);
        if (past.length > 100) past.shift();
        future.length = 0;
      }
      updateHistoryButtons();
      updateDirty();
      renderLayers();
      renderProps();
      renderElementTree();
    }
    function syncLayers() {
      const data = serialize();
      state.layers = data.layers;
      state.activeLayerId = data.active_layer_id;
    }
    function effectiveVisible(layer) {
      return layer.visible && (!isolated || isolated === layer.id);
    }
    function editable() {
      return C().editable(state) && (!isolated || isolated === state.activeLayerId);
    }
    function applyLayerRules() {
      for (const object of canvas.getObjects()) {
        const layer = C().find(state, object.layerId);
        const allowed = layer && layer.id === state.activeLayerId && editable();
        object.visible = Boolean(layer && effectiveVisible(layer));
        object.selectable = Boolean(allowed && tool === "select");
        object.evented = Boolean(allowed && (tool === "select" || tool === "erase"));
      }
      canvas.selection = tool === "select" && editable();
      canvas.skipTargetFind = !(tool === "select" || tool === "erase");
      if (tool !== "select" || !editable()) canvas.discardActiveObject();
      canvas.requestRenderAll();
      renderProps();
      get("ys-footer-layer").textContent = "Camada: " + (C().find(state)?.name || "—");
      renderComponentControls();
      renderElementTree();
    }
    function renderLayers() {
      const host = get("ys-layer-list");
      host.replaceChildren();
      // Ordem visual de cima para baixo; ordem serializada de baixo para cima.
      for (const layer of [...state.layers].reverse()) {
        const item = document.createElement("div");
        item.className = "ys-layer-item" + (layer.id === state.activeLayerId ? " active" : "");
        item.setAttribute("role", "listitem");
        const select = document.createElement("button");
        select.type = "button"; select.className = "ys-layer-select";
        select.textContent = layer.name;
        select.title = "Selecionar " + layer.name;
        on(select, "click", () => {
          finishComponent();
          state.activeLayerId = layer.id; setTool("select"); renderLayers(); applyLayerRules();
          commit();
        });
        const flag = (glyph, title, active, handler) => {
          const button = document.createElement("button");
          button.type = "button"; button.textContent = glyph; button.title = title;
          button.setAttribute("aria-label", title);
          button.className = active ? "active-flag" : "";
          on(button, "click", handler);
          return button;
        };
        item.append(select,
          flag(layer.visible ? "◉" : "○", layer.visible ? "Ocultar camada" : "Mostrar camada",
            layer.visible, () => { layer.visible = !layer.visible; applyLayerRules(); renderLayers(); commit(); }),
          flag(layer.locked ? "▣" : "▢", layer.locked ? "Desbloquear camada" : "Bloquear camada",
            layer.locked, () => { layer.locked = !layer.locked; applyLayerRules(); renderLayers(); commit(); }),
          flag(isolated === layer.id ? "◎" : "⊙", "Isolar camada (visualização)",
            isolated === layer.id, () => {
              isolated = isolated === layer.id ? null : layer.id;
              applyLayerRules(); renderLayers();
            })
        );
        host.appendChild(item);
      }
      const index = state.layers.findIndex(layer => layer.id === state.activeLayerId);
      get("ys-layer-up").disabled = index < 0 || index === state.layers.length - 1;
      get("ys-layer-down").disabled = index <= 0;
      get("ys-layer-delete").disabled = state.layers.length <= 1;
    }
    function addObject(object) {
      if (componentSession) object.componentParentId = componentSession.id;
      if (!editable()) { message("Desbloqueie e mostre a camada ativa para desenhar.", true); return false; }
      object.layerId = state.activeLayerId;
      object.set({objectCaching: false});
      canvas.add(object);
      ensureInside(object);
      applyLayerRules();
      return true;
    }
    function ensureInside(obj) {
      obj.setCoords();
      let bounds = obj.getBoundingRect(true, true);
      if (bounds.width > width || bounds.height > height) {
        const factor = Math.min(width / Math.max(1, bounds.width), height / Math.max(1, bounds.height), 1);
        if (factor < 1) obj.scale(obj.scaleX * factor);
        obj.setCoords(); bounds = obj.getBoundingRect(true, true);
      }
      const dx = bounds.left < 0 ? -bounds.left :
        bounds.left + bounds.width > width ? width - (bounds.left + bounds.width) : 0;
      const dy = bounds.top < 0 ? -bounds.top :
        bounds.top + bounds.height > height ? height - (bounds.top + bounds.height) : 0;
      if (dx || dy) obj.set({left: obj.left + dx, top: obj.top + dy});
      obj.setCoords();
    }
    function renderProps() {
      const object = canvas.getActiveObject();
      const valid = Boolean(object && object.type !== "activeSelection" && editable());
      const inputs = [
        ["ys-prop-x", "left"], ["ys-prop-y", "top"],
        ["ys-prop-w", "width"], ["ys-prop-h", "height"]
      ];
      inputs.forEach(([id, key]) => {
        const node = get(id); node.disabled = !valid;
        node.value = valid ? String(Math.round(key === "width" ? object.getScaledWidth() :
          key === "height" ? object.getScaledHeight() : object[key])) : "";
      });
      get("ys-delete").disabled = !valid;
      get("ys-duplicate").disabled = !valid;
      const input=get("ys-prop-text"), field=get("ys-text-field");
      const isText=Boolean(valid && (object.type==="i-text" || object.type==="textbox" || object.type==="text"));
      field.hidden=!isText;input.disabled=!isText;
      if(isText && document.activeElement!==input)input.value=object.text||"";
      const font=get("ys-font-size"), radius=get("ys-corner-radius");
      font.disabled=!isText;
      radius.disabled=!(valid && object.type==="rect");
      font.value=isText ? String(Math.round(object.fontSize||14)) : "";
      radius.value=valid && object.type==="rect" ? String(Math.round(object.rx||0)) : "";
      root.querySelectorAll("[data-align]").forEach(btn=>btn.disabled=!valid);
      const peers=valid ? canvas.getObjects().filter(candidate=>
        candidate.layerId===object.layerId && candidate.componentParentId===object.componentParentId) : [];
      const index=peers.indexOf(object);
      get("ys-bring-front").disabled=!valid || index===peers.length-1;
      get("ys-send-back").disabled=!valid || index<=0;
      renderComponentControls();
      renderElementTree();
      if (valid && typeof object.fill === "string" && /^#[a-f\d]{6}$/i.test(object.fill)) {
        get("ys-color").value = object.fill;
      }
    }


    function renderElementTree() {
      const host=get("ys-object-tree");
      if(!host || !E())return;
      host.replaceChildren();
      const selected=canvas.getActiveObject();
      const layers=E().describe(canvas.getObjects(),state.layers);
      const addButton=(label,level,active,action,title)=>{
        const button=document.createElement("button");
        button.type="button";
        button.className="ys-tree-row"+(active?" selected":"");
        button.style.paddingLeft=(6+level*15)+"px";
        button.title=title||label;
        button.setAttribute("role","treeitem");
        button.setAttribute("aria-level",String(level+1));
        button.setAttribute("aria-selected",String(Boolean(active)));
        const bullet=document.createElement("span");
        bullet.className="ys-tree-icon";
        bullet.textContent=level===0?"◧":level===1?"◇":"•";
        const text=document.createElement("span");
        text.className="ys-tree-text";
        text.textContent=label;
        button.append(bullet,text);
        // Nós recriados são descartados com suas próprias listeners.
        button.addEventListener("click",action);
        host.appendChild(button);
        return button;
      };
      for(const layer of layers){
        const collapsed=collapsedLayers.has(layer.id);
        const title=document.createElement("button");
        title.type="button";title.className="ys-tree-title ys-tree-header";
        title.textContent=(collapsed?"▸ ":"▾ ")+layer.name+
          (layer.locked?"  🔒":"")+(layer.visible?"":"  ◌");
        title.title="Recolher ou expandir objetos da camada";
        title.addEventListener("click",()=>{
          if(collapsed)collapsedLayers.delete(layer.id);
          else collapsedLayers.add(layer.id);
          renderElementTree();
        });
        host.appendChild(title);
        if(collapsed)continue;
        for(const node of layer.children){
          const obj=node.object;
          const inEdit=Boolean(componentSession && obj.componentParentId===componentSession.id);
          const button=addButton((inEdit?"↳ ":"")+node.name,inEdit?2:1,
            selected===obj,()=>{
              if(state.activeLayerId!==layer.id){
                finishComponent();
                state.activeLayerId=layer.id;
                setTool("select");renderLayers();
              }
              setTool("select");canvas.setActiveObject(obj);canvas.requestRenderAll();
              renderProps();
            });
          if(obj?.type==="i-text")button.addEventListener("dblclick",()=>{
            if(editable()){obj.enterEditing();obj.selectAll();}
          });
          if(!node.children.length)continue;
          for(const [i,child] of node.children.entries()){
            addButton(child.name,2,false,()=>{
              if(state.activeLayerId!==layer.id){
                finishComponent();
                state.activeLayerId=layer.id;
                setTool("select");renderLayers();
              }
              if(componentSession && componentSession.id!==obj.componentId)finishComponent();
              if(!componentSession)enterComponent(obj);
              if(!componentSession)return;
              const children=canvas.getObjects().filter(part=>
                part.componentParentId===componentSession.id);
              const item=children[i];
              if(item){
                setTool("select");canvas.setActiveObject(item);canvas.requestRenderAll();renderProps();
              }
            },"Editar parte interna do componente");
          }
        }
      }
    }

    function renderComponentControls() {
      const selected=canvas.getActiveObject(), session=componentSession;
      get("ys-edit-component").disabled=Boolean(session) || !Boolean(
        selected?.type==="group" && selected.componentKind && editable());
      get("ys-finish-component").hidden=!session;
      get("ys-add-icon").disabled=!session || !editable();
      get("ys-link-component").disabled=!session || !selected || selected.layerId!==session.layerId
        || selected.componentParentId===session.id || selected.type==="activeSelection" || selected.type==="group";
      get("ys-unlink-component").disabled=!session || !selected
        || selected.componentParentId!==session.id;
      get("ys-component-mode").textContent=session
        ? "Editando as partes de "+session.kind+". Arraste cada elemento e conclua para agrupá-los."
        : "Selecione um componente e clique em Editar partes (ou dê dois cliques).";
    }
    function enterComponent(object) {
      if(componentSession || !editable() || object?.layerId!==state.activeLayerId ||
         object?.type!=="group" || !object.componentKind)return;
      try {
        canvas.discardActiveObject();
        componentSession=window.AgataComponentEditing.enter(canvas,object,F());
        setTool("select");
        message("Edite texto, ícones e fundo separadamente. Depois conclua a edição.");
        renderComponentControls();
        canvas.requestRenderAll();
      } catch(error){alertError(error);}
    }
    function finishComponent(){
      if(!componentSession)return;
      const session=componentSession;
      try {
        canvas.discardActiveObject();
        const grouped=window.AgataComponentEditing.finish(canvas,session,F());
        componentSession=null;
        if(grouped){canvas.setActiveObject(grouped);ensureInside(grouped);}
        applyLayerRules();commit();
        message("Componente reunido. Agora suas partes se movem juntas.");
      } catch(error){componentSession=null;alertError(error);}
    }
    function addComponentIcon(){
      if(!componentSession || !editable())return;
      const first=canvas.getObjects().find(o=>o.componentParentId===componentSession.id);
      const x=first ? clamp(first.left+15,0,width-18) : 35;
      const y=first ? clamp(first.top+15,0,height-18) : 35;
      const icon=COMPONENTS().icon(get("ys-icon-kind").value,{left:x,top:y,stroke:get("ys-color").value});
      if(addObject(icon)){
        setTool("select");canvas.setActiveObject(icon);canvas.requestRenderAll();
        message("Ícone adicionado. Ajuste sua posição e clique em Concluir.");
        renderProps();
      }
    }
    function fitZoom() {
      const host = get("ys-scroll");
      const w = Math.max(100, host.clientWidth - 110), h = Math.max(100, host.clientHeight - 90);
      return clamp(Math.min(w / (width + 14), h / (height + 14), 1.2), .15, 2);
    }
    function setZoom(value) {
      zoom = clamp(value, .15, 3);
      const stage = get("ys-stage"), wrapper = get("ys-canvas-wrap");
      stage.style.width = ((width + 14) * zoom) + "px";
      stage.style.height = ((height + 14) * zoom) + "px";
      wrapper.style.width = (width + 14) + "px";
      wrapper.style.height = (height + 14) + "px";
      wrapper.style.transform = "scale(" + zoom + ")";
      get("ys-zoom-label").textContent = Math.round(zoom * 100) + "%";
      canvas.calcOffset();
    }
    function setTool(next) {
      if (!TOOLS.includes(next)) return;
      if (next !== "select" && !editable()) {
        message("A camada ativa está oculta ou bloqueada.", true); next = "select";
      } else message("");
      tool = next;
      canvas.isDrawingMode = next === "pen";
      if (canvas.isDrawingMode) {
        const brush = new (F().PencilBrush)(canvas);
        brush.color = get("ys-color").value;
        brush.width = Number(get("ys-brush-size").value);
        canvas.freeDrawingBrush = brush;
      }
      root.querySelectorAll("[data-tool]").forEach(button => {
        button.classList.toggle("active", button.dataset.tool === tool);
        button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
      });
      get("ys-tool-help").textContent = HELP[tool];
      applyLayerRules();
    }
    function enliven(serialized) {
      return new Promise((resolve, reject) => {
        try { F().util.enlivenObjects(serialized, objects => resolve(objects), null); }
        catch (error) { reject(error); }
      });
    }
    async function restore(data) {
      restoring = true;
      try {
        canvas.discardActiveObject();
        canvas.getObjects().slice().forEach(object => canvas.remove(object));
        state.layers = data.layers.map(layer => ({
          id:layer.id, name:layer.name, visible:layer.visible, locked:layer.locked,
          objects:layer.objects || []
        }));
        state.activeLayerId = data.active_layer_id;
        isolated = null;
        for (const layer of state.layers) {
          const restored = await enliven(layer.objects);
          if (disposed) return;
          for (const object of restored) {
            object.layerId = layer.id;
            object.set({objectCaching:false});
            canvas.add(object);
          }
        }
      } finally { restoring = false; }
      applyLayerRules(); renderLayers(); renderProps(); canvas.requestRenderAll();
      updateDirty();
    }
    async function undo() {
      finishComponent();
      if (past.length <= 1 || restoring) return;
      future.push(past.pop());
      await restore(JSON.parse(past.at(-1)));
      updateHistoryButtons();
    }
    async function redo() {
      finishComponent();
      if (!future.length || restoring) return;
      const next = future.pop();
      past.push(next);
      await restore(JSON.parse(next));
      updateHistoryButtons();
    }
    async function reorderLayer(direction) {
      finishComponent();
      syncLayers();
      if (!C().move(state, direction)) return;
      await restore({layers:state.layers, active_layer_id:state.activeLayerId});
      commit();
    }
    async function duplicateLayer() {
      finishComponent();
      syncLayers();
      C().duplicate(state);
      await restore({layers:state.layers, active_layer_id:state.activeLayerId});
      commit();
    }
    async function deleteLayer() {
      finishComponent();
      if (state.layers.length <= 1) return;
      if (!window.confirm("Excluir a camada e todos os objetos dela?")) return;
      syncLayers();
      C().remove(state);
      await restore({layers:state.layers, active_layer_id:state.activeLayerId});
      commit();
    }
    function screenPoint(event) {
      const p = canvas.getPointer(event.e);
      return {x: clamp(p.x, 0, width), y:clamp(p.y, 0, height)};
    }
    function makeShape(kind, x, y) {
      const color = get("ys-color").value;
      const base = {left:x, top:y, objectCaching:false, strokeWidth:2, stroke:color};
      if (kind === "rect") return new (F().Rect)({...base, width:1,height:1,fill:"transparent"});
      if (kind === "ellipse") return new (F().Ellipse)({...base,rx:1,ry:1,fill:"transparent"});
      if (kind === "triangle") return new (F().Triangle)({...base,width:1,height:1,fill:"transparent"});
      if (kind === "diamond") return new (F().Polygon)(
        [{x:50,y:0},{x:100,y:50},{x:50,y:100},{x:0,y:50}],
        {...base,scaleX:0.01,scaleY:0.01,fill:"transparent"}
      );
      return new (F().Line)([x,y,x,y],{stroke:color,strokeWidth:Math.max(2,Number(get("ys-brush-size").value)),objectCaching:false});
    }
    function resizeShape(shape, type, origin, point) {
      const x = Math.min(origin.x,point.x), y=Math.min(origin.y,point.y);
      const w=Math.max(1,Math.abs(point.x-origin.x)), h=Math.max(1,Math.abs(point.y-origin.y));
      if (type === "rect" || type === "triangle") shape.set({left:x,top:y,width:w,height:h});
      if (type === "diamond") shape.set({left:x,top:y,scaleX:w/100,scaleY:h/100});
      if (type === "ellipse") shape.set({left:x,top:y,rx:w/2,ry:h/2});
      if (type === "line") shape.set({x1:origin.x,y1:origin.y,x2:point.x,y2:point.y});
      shape.setCoords();canvas.requestRenderAll();
    }
    function onDown(event) {
      if (!editable()) return;
      if (tool === "erase") {
        if (event.target?.layerId === state.activeLayerId) {
          canvas.remove(event.target); canvas.discardActiveObject(); canvas.requestRenderAll(); commit();
        }
        return;
      }
      if (tool === "text") {
        const p = screenPoint(event);
        const object = new (F().IText)("Texto", {
          left:p.x,top:p.y,fill:get("ys-color").value,
          fontFamily:"Inter, Arial",fontSize:22,objectCaching:false
        });
        if (addObject(object)) {
          setTool("select");canvas.setActiveObject(object);canvas.requestRenderAll();commit();
          object.enterEditing();object.selectAll();
        }
        return;
      }
      if (!SHAPES.has(tool)) return;
      const p = screenPoint(event), object = makeShape(tool,p.x,p.y);
      if (addObject(object)) drawing = {origin:p,kind:tool,object};
    }
    function onMove(event) {
      if (drawing) {
        resizeShape(drawing.object,drawing.kind,drawing.origin,screenPoint(event));
      } else {
        const p = screenPoint(event);
        get("ys-pointer").textContent = "X: " + Math.round(p.x) + "  Y: " + Math.round(p.y) + " px";
      }
    }
    function onUp(event) {
      if (!drawing) return;
      const current = drawing; drawing = null;
      const point = screenPoint(event);
      if (Math.abs(point.x-current.origin.x)<3 && Math.abs(point.y-current.origin.y)<3) {
        point.x = clamp(current.origin.x + 75,0,width);
        point.y = clamp(current.origin.y + 45,0,height);
      }
      resizeShape(current.object,current.kind,current.origin,point);
      commit();
    }
    function propertyChange(key, value) {
      const object=canvas.getActiveObject();
      if (!object || !editable() || !Number.isFinite(value)) return;
      if (key === "left" || key === "top") object.set(key,value);
      if (key === "width" && object.width > 0) object.scaleX = clamp(value,1,4096)/object.width;
      if (key === "height" && object.height > 0) object.scaleY = clamp(value,1,4096)/object.height;
      ensureInside(object);canvas.requestRenderAll();commit();
    }
    function removeSelected() {
      const object = canvas.getActiveObject();
      if (!object || !editable() || object.layerId !== state.activeLayerId) return;
      canvas.remove(object);canvas.discardActiveObject();canvas.requestRenderAll();commit();
    }
    function duplicateSelected() {
      const object=canvas.getActiveObject();
      if (!object || !editable() || object.layerId !== state.activeLayerId) return;
      object.clone(copy => {
        if (disposed) return;
        copy.set({left:object.left+16, top:object.top+16});
        copy.componentKind=object.componentKind;
        if(object.componentKind)copy.componentId=window.AgataComponentEditing.newId();
        if (addObject(copy)) {canvas.setActiveObject(copy);canvas.requestRenderAll();commit();}
      }, ["layerId", "componentKind"]);
    }
    async function save() {
      if (saving || restoring) return;
      finishComponent();
      const data=serialize(), saved=JSON.stringify(data);
      saving=true;get("ys-save").disabled=true;
      get("ys-dirty-status").textContent="Salvando...";
      try {
        const result=await api.save_sketch(project.id,data);
        if (!result?.ok) throw new Error("Falha ao salvar o esboço.");
        if (disposed) return;
        savedSnapshot=saved;updateDirty();message("Projeto salvo no computador.");
      } catch(error) { if(!disposed) alertError(error); }
      finally{saving=false;if(!disposed)get("ys-save").disabled=false;}
    }
    function leaveTo(section,create=false) {
      finishComponent();
      if(snapshot()!==savedSnapshot &&
         !window.confirm("Existem alterações não salvas. Sair sem salvar?"))return;
      window.Vela.navigate("/home",{section,create});
    }
    function back() {
      finishComponent();
      if (snapshot() !== savedSnapshot &&
          !window.confirm("Existem alterações não salvas. Sair sem salvar?")) return;
      window.Vela.navigate("/home");
    }

    get("ys-title").textContent = project.name;
    get("ys-platform").textContent = project.platform.toUpperCase();
    const modes={svg:"Vetores · SVG",drawing:"Área de desenho",sketch:"Esboço"};
    root.querySelector(".ys-device-indicator").textContent =
      "● "+(modes[project.editor_mode] || "Esboço");
    get("ys-screen-name").textContent = screen.name || "Tela 1";
    get("ys-screen-size").textContent = width + " × " + height + " px";

    canvas.on("mouse:down", onDown);
    canvas.on("mouse:move", onMove);
    canvas.on("mouse:up", onUp);
    canvas.on("mouse:dblclick",({target})=>{
      if(target?.componentKind && !componentSession)enterComponent(target);
    });
    canvas.on("path:created", ({path}) => {
      path.layerId=state.activeLayerId;path.set({objectCaching:false});
      ensureInside(path);applyLayerRules();commit();
    });
    canvas.on("object:moving", ({target}) => {if (target) ensureInside(target);});
    canvas.on("object:modified", ({target}) => {if(target) ensureInside(target);commit();});
    canvas.on("text:changed", () => commit());
    canvas.on("text:editing:exited", () => commit());
    for (const event of ["selection:created","selection:updated","selection:cleared"]) {
      canvas.on(event,renderProps);
    }
    for(const [id,side] of [["ys-toggle-tools","left"],["ys-toggle-inspector","right"]]){
      on(get(id),"click",()=>{
        const open=!root.classList.contains("ys-show-"+side);
        for(const [other,otherSide] of [["ys-toggle-tools","left"],["ys-toggle-inspector","right"]]){
          const active=open && side===otherSide;
          root.classList.toggle("ys-show-"+otherSide,active);
          get(other).setAttribute("aria-expanded",String(active));
        }
      });
    }
    on(get("ys-android"),"click",()=>{
      finishComponent();
      if(snapshot()!==savedSnapshot&&!window.confirm("Existem alterações não salvas. Sair sem salvar?"))return;
      window.Vela.navigate("/android",{project_id:project.id});
    });
    on(get("ys-save"),"click",save);
    on(get("ys-go-new"),"click",()=>leaveTo("home",true));
    on(get("ys-go-recents"),"click",()=>leaveTo("projects"));
    on(get("ys-go-models"),"click",()=>leaveTo("templates"));
    on(get("ys-toggle-grid"),"click",()=>{
      const host=get("ys-scroll");
      const off=host.classList.toggle("ys-grid-off");
      get("ys-toggle-grid").textContent=off?"Grade ○":"Grade ●";
      get("ys-toggle-grid").setAttribute("aria-pressed",String(!off));
    });
    for(const btn of root.querySelectorAll("[data-swatch]")){
      on(btn,"click",()=>{
        get("ys-color").value=btn.dataset.swatch;
        get("ys-color").dispatchEvent(new Event("input",{bubbles:true}));
        get("ys-color").dispatchEvent(new Event("change",{bubbles:true}));
        root.querySelectorAll("[data-swatch]").forEach(other=>
          other.classList.toggle("active",other===btn));
      });
    }
    on(get("ys-pick-color"),"click",()=>get("ys-color").click());
    async function exportAs(format) {
      if(saving || disposed)return;
      try{
        if(snapshot()!==savedSnapshot)await save();
        if(snapshot()!==savedSnapshot)throw Error("Salve o projeto antes de exportar.");
        const payload=format==="svg"?canvas.toSVG({suppressPreamble:true}):
          format==="png"?canvas.toDataURL({format:"png",multiplier:1}):"";
        if(typeof api.export_artwork!=="function")throw Error("Atualize o backend para exportar.");
        const result=await api.export_artwork(project.id,format,payload);
        if(!result?.ok)throw Error("Não foi possível exportar o projeto.");
        message("Exportado: "+result.path);
      }catch(e){alertError(e);}
    }
    for(const format of ["svg","png","json"]){
      on(get("ys-export-"+format),"click",()=>exportAs(format));
    }
    on(get("ys-edit-component"),"click",()=>enterComponent(canvas.getActiveObject()));
    on(get("ys-finish-component"),"click",finishComponent);
    on(get("ys-add-icon"),"click",addComponentIcon);
    on(get("ys-link-component"),"click",()=>{
      if(!componentSession)return;
      const object=canvas.getActiveObject();
      if(window.AgataComponentEditing.link(object,componentSession)){
        message("Elemento vinculado: acompanhará o componente.");
        renderComponentControls();
      } else message("Selecione um elemento solto da camada para vincular.",true);
    });
    on(get("ys-unlink-component"),"click",()=>{
      if(!componentSession)return;
      const object=canvas.getActiveObject();
      if(window.AgataComponentEditing.unlink(object,componentSession)){
        message("Elemento desvinculado e independente.");
        renderComponentControls();
      }
    });
    on(get("ys-prop-text"),"change",()=>{
      const object=canvas.getActiveObject();
      if(!object || !editable() || !("text" in object))return;
      object.set("text",get("ys-prop-text").value);object.setCoords();
      canvas.requestRenderAll();commit();
    });
    on(get("ys-home"),"click",back);
    on(get("ys-fatal-home"),"click",back);
    on(get("ys-undo"),"click",() => undo().catch(alertError));
    on(get("ys-redo"),"click",() => redo().catch(alertError));
    on(get("ys-fit"),"click",() => setZoom(fitZoom()));
    on(get("ys-zoom-in"),"click",() => setZoom(zoom*1.2));
    on(get("ys-zoom-out"),"click",() => setZoom(zoom/1.2));
    for (const button of root.querySelectorAll("[data-tool]")) {
      on(button,"click",() => setTool(button.dataset.tool));
    }
    for (const button of root.querySelectorAll("[data-component]")) {
      on(button,"click",() => {
        if (!editable()) {alertError(new Error("Desbloqueie a camada ativa."));return;}
        try {
          const object=COMPONENTS().build(button.dataset.component,get("ys-color").value,width,height);
          if (addObject(object)) {setTool("select");canvas.setActiveObject(object);canvas.requestRenderAll();commit();}
        } catch (error) {alertError(error);}
      });
    }
    on(get("ys-color"),"input",() => {
      if (canvas.freeDrawingBrush) canvas.freeDrawingBrush.color=get("ys-color").value;
    });
    on(get("ys-color"),"change",() => {
      const object=canvas.getActiveObject();
      if (!object || !editable()) return;
      const color=get("ys-color").value;
      if (object.type==="path" || object.type==="line") object.set("stroke",color);
      else if (object.type==="group") {
        const background=object.getObjects().find(child => child.type === "rect");
        if (background) background.set("fill",color);
      } else object.set("fill",color);
      canvas.requestRenderAll();commit();
    });
    on(get("ys-brush-size"),"input",() => {
      const size=Number(get("ys-brush-size").value);
      get("ys-brush-label").textContent=size+" px";
      if(canvas.freeDrawingBrush)canvas.freeDrawingBrush.width=size;
    });
    for (const [id,key] of [["ys-prop-x","left"],["ys-prop-y","top"],
       ["ys-prop-w","width"],["ys-prop-h","height"]]) {
      on(get(id),"change",() => propertyChange(key,Number(get(id).value)));
    }
    on(get("ys-delete"),"click",removeSelected);
    on(get("ys-duplicate"),"click",duplicateSelected);
    on(get("ys-font-size"),"change",()=>{
      const obj=canvas.getActiveObject();
      if(!obj || !["text","i-text","textbox"].includes(obj.type) || !editable())return;
      const value=Number(get("ys-font-size").value);
      if(!Number.isFinite(value))return;
      obj.set("fontSize",clamp(value,6,160));
      obj.setCoords();ensureInside(obj);canvas.requestRenderAll();commit();
    });
    on(get("ys-corner-radius"),"change",()=>{
      const obj=canvas.getActiveObject();
      if(!obj || obj.type!=="rect" || !editable())return;
      const value=Number(get("ys-corner-radius").value);
      if(!Number.isFinite(value))return;
      obj.set({rx:clamp(value,0,200),ry:clamp(value,0,200)});
      canvas.requestRenderAll();commit();
    });
    for(const button of root.querySelectorAll("[data-align]")){
      on(button,"click",()=>{
        const obj=canvas.getActiveObject();
        if(!obj || !editable())return;
        if(E().align(obj,width,height,button.dataset.align)){
          ensureInside(obj);canvas.requestRenderAll();commit();
        }
      });
    }
    for(const [id,step] of [["ys-bring-front",1],["ys-send-back",-1]]){
      on(get(id),"click",()=>{
        const obj=canvas.getActiveObject();
        if(obj && editable() && E().move(canvas,obj,step)){
          canvas.setActiveObject(obj);canvas.requestRenderAll();commit();
        }
      });
    }
    on(get("ys-layer-duplicate"),"click",() => duplicateLayer().catch(alertError));
    on(get("ys-add-layer"),"click",() => {
      finishComponent();
      try {C().add(state);setTool("select");renderLayers();commit();}
      catch(error){alertError(error);}
    });
    on(get("ys-layer-up"),"click",() => reorderLayer(1).catch(alertError));
    on(get("ys-layer-down"),"click",() => reorderLayer(-1).catch(alertError));
    on(get("ys-layer-delete"),"click",() => deleteLayer().catch(alertError));
    on(get("ys-layer-rename"),"click",() => {
      finishComponent();
      const layer=C().find(state);if(!layer)return;
      const name=window.prompt("Nome da camada:",layer.name);
      if(name===null)return;
      const trimmed=name.trim();
      if(!trimmed || trimmed.length>60){message("Nome deve ter de 1 a 60 caracteres.",true);return;}
      layer.name=trimmed;renderLayers();commit();
    });
    const keydown = event => {
      if (event.target instanceof Element && event.target.closest("input,textarea,[contenteditable]")) return;
      if (canvas.getActiveObject()?.isEditing) return;
      const key=event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key==="s") {
        event.preventDefault();save();return;
      }
      if ((event.ctrlKey || event.metaKey) && key==="z") {
        event.preventDefault();(event.shiftKey?redo():undo()).catch(alertError);return;
      }
      if ((event.ctrlKey || event.metaKey) && key==="y") {
        event.preventDefault();redo().catch(alertError);return;
      }
      if ((event.ctrlKey || event.metaKey) && key==="d"){
        event.preventDefault();duplicateSelected();return;
      }
      if(key==="escape"){
        event.preventDefault();
        if(componentSession)finishComponent();
        else{canvas.discardActiveObject();canvas.requestRenderAll();renderProps();}
        return;
      }
      if(key==="f2"){
        const obj=canvas.getActiveObject();
        if(obj?.type==="i-text" && editable()){
          event.preventDefault();obj.enterEditing();obj.selectAll();
        }
        return;
      }
      if (key==="delete" || key==="backspace") {event.preventDefault();removeSelected();return;}
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const shortcuts={v:"select",p:"pen",e:"erase",t:"text",r:"rect",o:"ellipse",l:"line"};
      if(shortcuts[key])setTool(shortcuts[key]);
    };
    on(document,"keydown",keydown);
    const page=window.VelaPage || {};
    const previous=page.beforeUnmount;
    page.beforeUnmount=async function() {
      disposed=true;abort.abort();notifications.dispose();canvas.dispose();
      if (typeof previous==="function") await previous.call(this);
    };
    window.VelaPage=page;
    await restore({layers:state.layers,active_layer_id:state.activeLayerId});
    savedSnapshot=snapshot();
    past.push(savedSnapshot);
    updateHistoryButtons();updateDirty();setTool("select");setZoom(fitZoom());
    get("ys-save").disabled=false;get("ys-message").hidden=true;renderElementTree();
  }
  window.AgataSketchEditor={mount};
})();
