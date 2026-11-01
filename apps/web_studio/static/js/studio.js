(function (global) {
  "use strict";
  async function mount(root) {
    const q = (id) => root.querySelector("#ws-" + id),
      abort = new AbortController(),
      on = (el, event, fn) =>
        el?.addEventListener(event, fn, { signal: abort.signal }),
      api = (name, ...args) => {
        const fn = global.pywebview?.api?.[name];
        if (typeof fn !== "function") throw Error("Bridge Vela indisponível");
        return fn(...args);
      };
    let doc,
      code,
      canvas,
      catalog,
      selected = null,
      selectedInstance = null,
      selection = new Set(),
      page = "index.html",
      activeFile = null,
      selectedPath = null,
      tabs = [],
      mode = "split",
      timer,
      autosaveTimer,
      previewSession,
      previewNonce,
      saving = false,
      disposed = false,
      clipboard = "";
    let layoutManager, zoomController;
    const logs = [];
    let languageProblems = [];
    const gradientEditor = new global.AgataWebEffects.GradientEditor(root);
    new global.AgataWebEffects.AnimationTimeline(root);
    const inspector = global.AgataWebInspector.create({
      q,
      on,
      getDocument: () => doc,
      getCanvas: () => canvas,
      getSelected: () => selected,
      getInstance: () => selectedInstance,
      getSelection: () => selection,
      gradientEditor,
      fail: (e) => fail(e),
    });
    const status = (text) => {
        q("status").textContent = text;
      },
      log = (message) => {
        logs.push(String(message).slice(0, 6000));
        q("console").textContent = logs.slice(-80).join("\n");
      },
      fail = (e) => {
        status(e.message || String(e));
        log(e.stack || e.message || e);
      };
    function ask(title, label, value = "") {
      return new Promise((resolve) => {
        q("dialog-title").textContent = title;
        q("dialog-label").textContent = label;
        q("dialog-input").value = value;
        const dialog = q("dialog");
        const done = () => {
          resolve(dialog.returnValue === "ok" ? q("dialog-input").value : null);
        };
        dialog.addEventListener("close", done, { once: true });
        dialog.showModal();
        q("dialog-input").focus();
      });
    }
    function prefs() {
      try {
        return JSON.parse(localStorage.getItem("agata-web-layout") || "{}");
      } catch {
        return {};
      }
    }
    function persistLayout() {
      localStorage.setItem(
        "agata-web-layout",
        JSON.stringify({
          left: root.dataset.left,
          right: root.dataset.right,
          leftWidth: root.style.getPropertyValue("--ws-left"),
          rightWidth: root.style.getPropertyValue("--ws-right"),
          mode,
          splitWidth: q("design").style.width,
          bottomOpen: root.querySelector("footer details").open,
        }),
      );
    }
    function setMode(value) {
      mode = value;
      root.dataset.mode = value;
      for (const b of root.querySelectorAll("button[data-mode]"))
        b.setAttribute("aria-pressed", String(b.dataset.mode === value));
      layoutManager?.setMode(value);
      persistLayout();
      code?.editor.layout();
      if (value === "preview") refreshPreview();
    }
    const ideThemes = new Set(["system", "light", "dark"]);
    const setIdeTheme = value => {
      root.dataset.ideTheme = ideThemes.has(value) ? value : "system";
      q("ide-theme").value = root.dataset.ideTheme;
      localStorage.setItem("agata-ide-theme", root.dataset.ideTheme);
      const dark = root.dataset.ideTheme === "dark" ||
        (root.dataset.ideTheme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      if (code?.monaco?.editor) code.monaco.editor.setTheme(dark ? "vs-dark" : "vs");
    };
    const systemTheme = matchMedia("(prefers-color-scheme: dark)");
    on(systemTheme, "change", () => {
      if (root.dataset.ideTheme === "system") setIdeTheme("system");
    });
    setIdeTheme(localStorage.getItem("agata-ide-theme") || "system");
    on(q("ide-theme"), "change", () => setIdeTheme(q("ide-theme").value));
    const pref = prefs();
    layoutManager = new global.AgataWebWorkspaceLayout.WorkspaceLayoutManager(root,{
      onResize:()=>{code?.editor.layout();zoomController?.apply();},
      onUpdate:()=>{
        persistLayout();
        if(zoomController && zoomController.mode!==layoutManager.state.zoomMode){
          if(layoutManager.state.zoomMode==="custom")zoomController.setPercent(layoutManager.state.zoomPercent);
          else zoomController.fit(layoutManager.state.zoomMode);
          updateZoomDisplay();
        }
      }
    });
    if(pref.bottomOpen===false)root.querySelector("footer details").open=false;
    on(root.querySelector("footer details"),"toggle",persistLayout);
    const designObserver=new ResizeObserver(()=>{code?.editor.layout();zoomController?.apply();});
    designObserver.observe(q("design"));
    const updateZoomDisplay=()=>{
      if(!zoomController)return;
      q("zoom-value").value=zoomController.value();
      q("zoom-mode").value=zoomController.mode;
      q("zoom-value").disabled=false;
    };
    const setZoom=(mode,value)=>{
      if(!zoomController)return;
      if(mode==="custom")zoomController.setPercent(value);
      else zoomController.fit(mode);
      layoutManager.state.zoomMode=zoomController.mode;
      layoutManager.state.zoomPercent=zoomController.percent;
      layoutManager.persist();updateZoomDisplay();
      status((mode==="fit-width"?"Canvas ajustado · ":"Zoom do canvas: ")+zoomController.value()+"% · viewport "+q("width").value+"px");
    };
    on(q("zoom-mode"),"change",()=>setZoom(q("zoom-mode").value,Number(q("zoom-value").value)));
    on(q("zoom-value"),"change",()=>setZoom("custom",Number(q("zoom-value").value)));
    on(q("zoom-minus"),"click",()=>setZoom("custom",Math.max(20,zoomController.value()-15)));
    on(q("zoom-plus"),"click",()=>setZoom("custom",Math.min(300,zoomController.value()+15)));
    function button(text, click) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.onclick = () => Promise.resolve().then(click).catch(fail);
      return b;
    }
    function open(file) {
      if (doc.files.get(file)?.encoding !== "utf8") {
        status("Asset binário: " + file);
        return;
      }
      if (!tabs.includes(file)) tabs.push(file);
      activeFile = file;
      selectedPath = file;
      code.open(file);
      renderFiles();
      renderTabs();
    }
    function renderTabs() {
      q("tabs").replaceChildren(
        ...tabs
          .filter((p) => doc.files.has(p))
          .map((file) => {
            const e = doc.files.get(file),
              b = button(
                file +
                  (e.content !== doc.baselineContent.get(file)?.content ||
                  !doc.baseline.has(file)
                    ? " •"
                    : ""),
                () => open(file),
              );
            b.setAttribute("role", "tab");
            b.setAttribute("aria-selected", String(file === activeFile));
            return b;
          }),
      );
    }
    function renderFiles() {
      const filter = q("search-files").value.toLowerCase(),
        items = [];
      const folders = new Set(doc.metadata.folders || []);
      for (const path of doc.files.keys()) {
        const parts = path.split("/");
        for (let i = 1; i < parts.length; i++)
          folders.add(parts.slice(0, i).join("/"));
      }
      for (const folder of [...folders].sort())
        items.push(
          button("▸ " + folder + "/", () => {
            selectedPath = folder;
            status("Pasta " + folder);
          }),
        );
      for (const [file, e] of [...doc.files].sort(([a], [b]) =>
        a.localeCompare(b),
      ))
        if (file.toLowerCase().includes(filter)) {
          const b = button((e.encoding === "utf8" ? "" : "◈ ") + file, () =>
            open(file),
          );
          b.dataset.file = file;
          if (file === activeFile) b.setAttribute("aria-current", "true");
          items.push(b);
        }
      global.AgataWebLists.renderList(q("files"), items, (item) => item);
      const pages = [...doc.files.keys()].filter(
        (f) => /\.html?$/i.test(f) && !f.startsWith("components/"),
      );
      q("page").replaceChildren(...pages.map((f) => new Option(f, f)));
      q("page").value = page;
    }
    function renderTree() {
      const nodes = [...doc.nodes.values()].filter(
        (n) => n.file === page || n.file.startsWith("components/"),
      );
      global.AgataWebLists.renderList(q("tree"), nodes, (n) => {
        let depth = 0;
        for (let p = n.parent; p; p = p.parent) depth++;
        const b = button(
          n.tag + (n.attributes.id ? " #" + n.attributes.id : ""),
          () => select(n.id),
        );
        b.style.paddingLeft = depth * 10 + "px";
        b.setAttribute("role", "treeitem");
        b.setAttribute("aria-selected", String(selection.has(n.id)));
        b.dataset.node = n.id;
        b.onclick = (e) => select(n.id, e.ctrlKey || e.metaKey);
        b.draggable = true;
        b.ondragstart = (e) =>
          e.dataTransfer.setData("application/agata-node", n.id);
        b.ondragover = (e) => e.preventDefault();
        b.ondrop = (e) => {
          e.preventDefault();
          try {
            const id = e.dataTransfer.getData("application/agata-node");
            if (id) doc.move(id, n.id);
            else {
              const block = e.dataTransfer.getData("application/agata-block");
              const html = canvas.blocks.get(block);
              if (html) doc.insert(page, n.id, html);
            }
          } catch (err) {
            fail(err);
          }
        };
        return b;
      });
    }
    function select(id, append = false, context = null) {
      if (!doc.nodes.has(id)) return;
      if (!append) selection.clear();
      selection.add(id);
      selected = id;
      selectedInstance = context?.includeId || null;
      canvas.select(id, append, selectedInstance);
      renderTree();
      renderInspector();
    }
    function renderInspector() {
      inspector.render();
    }
    function buildInspector() {
      inspector.build();
    }
    function insertLibraryBlock(id, parent, before = null) {
      const definition = catalog.blocks.find((b) => "block:" + b.name === id);
      if (definition)
        global.AgataWebLibrary.insert(
          doc,
          definition,
          parent,
          before,
          catalog.blockResources,
          page,
        );
      else {
        const html = canvas.blocks.get(id);
        if (html) doc.insert(page, parent, html, before);
      }
    }
    function availableBlocks() {
      const elements = (catalog.elements || [])
        .filter(e => !e.deprecated && e.visual !== false)
        .map(e => ({
          id: "html:" + e.name,
          name: "<" + e.name + ">",
          category: "HTML · " + (e.category || "Outros"),
          html: global.AgataWebCatalog.elementHtml(e.name),
        }));
      return [
        ...catalog.blocks.map(b => ({ ...b, id: "block:" + b.name,
          category: "Blocos · " + (b.category || "Layouts") })),
        ...elements,
      ];
    }
    function renderBlocks(filter = "") {
      const category = q("block-category").value || "all";
      const blocks = availableBlocks().filter(b =>
        (category === "all" || b.category === category) &&
        b.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase())
      );
      const groups = new Map();
      for (const block of blocks) {
        canvas.blocks.set(block.id, block.html);
        if (!groups.has(block.category)) groups.set(block.category, []);
        groups.get(block.category).push(block);
      }
      const host = q("blocks");
      host.replaceChildren();
      for (const [name, entries] of groups) {
        const region = document.createElement("section");
        region.className = "ws-block-group";
        region.setAttribute("aria-label", name);
        const heading = document.createElement("h4");
        heading.textContent = name + " (" + entries.length + ")";
        const list = document.createElement("div");
        list.className = "ws-block-group-grid";
        for (const b of entries) {
          const el = button(b.name, () => insertLibraryBlock(b.id, selected));
          el.draggable = true;
          el.title = "Arraste para o canvas ou clique para inserir " + b.name;
          el.ondragstart = e =>
            e.dataTransfer.setData("application/agata-block", b.id);
          list.append(el);
        }
        region.append(heading, list);
        host.append(region);
      }
      if (!host.childElementCount) {
        const empty = document.createElement("p");
        empty.textContent = "Nenhum componente nessa categoria. Altere a busca ou o filtro.";
        host.append(empty);
      }
      host.setAttribute("aria-label", blocks.length + " elementos e blocos disponíveis");
    }
    async function refreshPreview() {
      if (!doc || disposed) return;
      try {
        const files = await global.AgataWebAdapters.previewFiles(
            doc,
            q("reduced").checked,
          ),
          result = await api(
            "web_preview",
            files,
            page,
            q("network").checked,
            previewSession,
          );
        if (disposed) return;
        previewSession = result.session;
        previewNonce = result.nonce;
        q("preview").src = result.url;
        q("preview").style.width = q("width").value + "px";
      } catch (e) {
        fail(e);
      }
    }
    function diagnostics() {
      const messages = doc.diagnostics.map(
        (d) => d.file + (d.line ? ":" + d.line : "") + " " + d.message,
      );
      for (const n of doc.nodes.values()) {
        if (n.tag === "img" && !("alt" in n.attributes))
          messages.push(
            n.file +
              ":" +
              n.location.startLine +
              " Acessibilidade: imagem sem alt",
          );
        if (
          n.tag === "input" &&
          !n.attributes.id &&
          !n.attributes["aria-label"] &&
          !(() => {
            for (let p = n.parent; p; p = p.parent)
              if (p.tag === "label") return true;
            return false;
          })()
        )
          messages.push(
            n.file +
              ":" +
              n.location.startLine +
              " Acessibilidade: input sem label associado",
          );
      }
      q("problems").textContent = [
        ...messages,
        ...languageProblems.map((m) => m.file + ":" + m.line + " " + m.message),
      ]
        .slice(0, 80)
        .join("\n");
    }
    function changed() {
      queueMicrotask(() => {
        if (disposed) return;
        root.querySelector('[data-action="undo"]').disabled =
          !doc.history.past.length;
        root.querySelector('[data-action="redo"]').disabled =
          !doc.history.future.length;
      });
      renderFiles();
      renderTabs();
      renderTree();
      status("Alterações não salvas");
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          canvas.render(page);
          renderInspector();
          diagnostics();
          if (mode === "preview") refreshPreview();
        } catch (e) {
          fail(e);
        }
      }, 250);
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(
        async () => {
          if (disposed) return;
          try {
            await api("save_web_recovery", doc.project.id, doc.payload());
            if (q("autosave").checked) await save();
          } catch (e) {
            fail(e);
          }
        },
        Math.max(5, Number(q("autosave-interval").value) || 30) * 1000,
      );
    }
    async function save() {
      if (!doc || saving) return;
      saving = true;
      try {
        const payload = doc.payload();
        if (!doc.dirty) {
          status("Salvo");
          return;
        }
        const versions = new Map(
          [...doc.files].map(([p, e]) => [p, e.version]),
        );
        const result = await api("save_web_project", doc.project.id, payload);
        doc.revision = result.revision;
        doc.metadataBaseline = JSON.stringify(payload.metadata);
        for (const p of payload.deleted) doc.baseline.delete(p);
        for (const [p, hash] of Object.entries(result.files)) {
          doc.baseline.set(p, hash);
          doc.baselineContent.set(p, {
            content: payload.files[p].content,
            encoding: payload.files[p].encoding,
          });
          if (payload.files[p].encoding === "utf8")
            code.savedModels.set(p, payload.files[p].content);
          const entry = doc.files.get(p);
          if (entry && entry.version === versions.get(p)) {
            entry.sha256 = hash;
          }
        }
        status("Salvo · revisão " + result.revision);
        renderTabs();
      } finally {
        saving = false;
      }
    }
    async function load(projectId) {
      if (doc) {
        code.dispose();
        canvas.dispose();
      }
      const snapshot = await api("get_web_project", projectId);
      doc = new global.AgataWebDomain.WebDocument(
        snapshot,
        global.AgataWebParsers,
        { references: global.AgataWebReferences },
      );
      global.AgataWebSession = doc;
      page = doc.metadata.entry;
      tabs = [];
      selected = null;
      code = new global.AgataWebAdapters.MonacoAdapter(
        q("monaco"),
        doc,
        (file) => {
          activeFile = file;
        },
      );
      canvas = new global.AgataWebAdapters.CanvasAdapter(
        q("canvas"),
        doc,
        select,
        fail,
      );
      zoomController=new global.AgataWebWorkspaceLayout.CanvasZoomController(
        canvas,()=>Number(q("width").value)||1440,()=>q("design"));
      zoomController.mode=layoutManager.state.zoomMode||"fit-width";
      zoomController.percent=layoutManager.state.zoomPercent||100;
      canvas.blocks = new Map();
      canvas.onKeyDown = keyboard;
      canvas.onInsert = insertLibraryBlock;
      code.onNode = (id) => select(id);
      code.onDiagnostics = (items) => {
        languageProblems = items;
        diagnostics();
      };
      doc.subscribe(changed);
      doc.normalize();
      // Stable identity bookkeeping is not a user action and cannot be undone.
      doc.history.past = [];
      doc.history.future = [];
      root.querySelector('[data-action="undo"]').disabled = true;
      root.querySelector('[data-action="redo"]').disabled = true;
      if (
        snapshot.recovery &&
        snapshot.recovery.revision === snapshot.revision
      ) {
        log(
          "Rascunho de recuperação encontrado; use Restaurar recovery no console via botão abaixo.",
        );
        const b = button("Restaurar rascunho recuperado", () => {
          const changes = Object.entries(snapshot.recovery.files || {})
            .filter(([, e]) => e.encoding === "utf8")
            .map(([file, e]) => ({
              file,
              before: doc.files.has(file) ? doc.text(file) : null,
              after: e.content,
            }));
          doc.command("Restaurar recuperação", changes);
          b.remove();
        });
        q("console").after(b);
      }
      canvas.render(page);
      buildInspector();
      renderBlocks();
      renderFiles();
      renderTree();
      open(page);
      q("tokens").value = doc.files.has("css/tokens.css")
        ? doc.text("css/tokens.css")
        : ":root { }";
      for (const [file, e] of doc.files)
        if (e.encoding === "utf8")
          code.savedModels.set(
            file,
            doc.baselineContent.get(file)?.content || e.content,
          );
      q("autosave").checked = doc.metadata.settings?.autosave !== false;
      q("autosave-interval").value =
        doc.metadata.settings?.autosaveInterval || 30;
      q("reduced").checked = !!doc.metadata.settings?.reducedMotion;
      q("network").checked = !!doc.metadata.settings?.allowHttps;
      setMode(pref.mode || (innerWidth < 900 ? "design" : "split"));
      root.dataset.projectState = "ready";
      root.querySelector(".ws-layout").hidden = false;
      q("welcome").hidden = true;
      requestAnimationFrame(()=>{zoomController?.apply();updateZoomDisplay();code?.editor.layout();});
      status("Projeto " + doc.project.name);
    }
    const actions = {
      home: () => global.Vela.navigate("/home"),
      create: async () => {
        const name = await ask("Novo projeto Web", "Nome", "Meu projeto Web");
        if (name) {
          const p = await api(
            "create_web_project",
            name,
            q("project-template").value,
          );
          await global.Vela.navigate("/web", { project_id: p.id });
        }
      },
      import: async () => {
        const path = await ask(
          "Importar cópia Web",
          "Pasta, ZIP ou arquivo HTML",
        );
        if (path) {
          const p = await api("import_web_project", path);
          await global.Vela.navigate("/web", { project_id: p.id });
        }
      },
      save,
      saveas: async () => {
        await save();
        const p = await api("project_action", doc.project.id, "duplicate");
        await global.Vela.navigate("/web", { project_id: p.id });
      },
      undo: () => doc.history.undo(),
      redo: () => doc.history.redo(),
      export: async () => {
        await save();
        const r = await api("export_web_project", doc.project.id);
        status("ZIP: " + r.path);
        log("Exportado: " + r.path);
      },
      left:()=>layoutManager.toggle("left"),
      right:()=>layoutManager.toggle("right"),
      newfile: async () => {
        const p = await ask(
          "Criar arquivo",
          "Caminho relativo",
          "pages/new.html",
        );
        if (p) {
          if (doc.files.has(p)) throw Error("Arquivo já existe");
          doc.edit(
            p,
            /\.html?$/i.test(p)
              ? '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><title>Nova página</title></head><body><main data-agata-id="' +
                  crypto.randomUUID().replaceAll("-", "") +
                  '"><h1>Nova página</h1></main></body></html>'
              : "",
            "Criar arquivo",
          );
          open(p);
        }
      },
      folder: async () => {
        const p = await ask("Criar pasta", "Caminho relativo", "assets/images");
        if (p) {
          global.AgataWebDomain.path(p);
          doc.editMetadata(
            "Criar pasta",
            (metadata) =>
              (metadata.folders = [
                ...new Set([...(metadata.folders || []), p]),
              ]),
          );
        }
      },
      rename: async () => {
        const p = await ask(
          "Renomear/mover arquivo",
          "Links, CSS URLs e imports locais reconhecidos serão atualizados.",
          selectedPath || activeFile,
        );
        if (p) {
          const from = selectedPath || activeFile,
            map = (value) =>
              value === from || value?.startsWith(from + "/")
                ? p + value.slice(from.length)
                : value;
          doc.renamePath(from, p);
          page = map(page);
          activeFile = map(activeFile);
          tabs = tabs.map(map);
          selectedPath = p;
          renderFiles();
          renderTabs();
          if (doc.files.has(activeFile)) open(activeFile);
          canvas.render(page);
        }
      },
      duplicatefile: async () => {
        const p = await ask(
          "Duplicar arquivo",
          "Novo caminho",
          activeFile.replace(/(\.[^.]+)$/, "-copy$1"),
        );
        if (p) {
          if (doc.files.has(p)) throw Error("Arquivo já existe");
          doc.duplicateFile(selectedPath || activeFile, p);
          open(p);
        }
      },
      deletefile: () => doc.removePath(selectedPath || activeFile),
      entry: () => {
        doc.editMetadata(
          "Página inicial",
          (metadata) => (metadata.entry = page),
        );
        status("Página inicial: " + page);
      },
      asset: () => q("upload").click(),
      detachcomponent: () => {
        if (!selectedInstance)
          throw Error("Selecione um filho de componente no canvas");
        doc.detachComponent(selectedInstance);
        selected = null;
        selectedInstance = null;
      },
      parent: () => {
        const n = doc.node(selected);
        if (n.parent?.id) select(n.parent.id);
      },
      copy: () => {
        clipboard = doc
          .topNodes([...selection])
          .map((n) => doc.text(n.file).slice(n.start, n.end))
          .join("\n");
        status("Elementos copiados");
      },
      paste: () => {
        if (clipboard) doc.insert(page, selected, clipboard);
      },
      duplicate: () =>
        doc.transaction("Duplicar seleção", () => {
          for (const n of doc.topNodes([...selection])) doc.duplicate(n.id);
        }),
      delete: () => {
        doc.transaction("Excluir seleção", () => {
          for (const n of doc.topNodes([...selection]).reverse())
            doc.remove(n.id);
        });
        selected = null;
        selection.clear();
      },
      up: () => {
        const n = doc.node(selected),
          siblings = n.parent?.children || [],
          index = siblings.indexOf(n);
        if (index > 0)
          doc.move(n.id, n.parent?.id || null, siblings[index - 1].id);
      },
      down: () => {
        const n = doc.node(selected),
          siblings = n.parent?.children || [],
          index = siblings.indexOf(n);
        if (index >= 0 && index < siblings.length - 1)
          doc.move(n.id, n.parent?.id || null, siblings[index + 2]?.id || null);
      },
      center: () =>
        new global.AgataWebLayout.LayoutService(doc, (id) =>
          canvas.computed(id),
        ).center(selected),
      centerh: () =>
        new global.AgataWebLayout.LayoutService(doc, (id) =>
          canvas.computed(id),
        ).center(selected, "horizontal"),
      centerv: () =>
        new global.AgataWebLayout.LayoutService(doc, (id) =>
          canvas.computed(id),
        ).center(selected, "vertical"),
      distribute: () =>
        new global.AgataWebLayout.LayoutService(doc, (id) =>
          canvas.computed(id),
        ).distribute(selected),
      autoflex: () =>
        new global.AgataWebLayout.LayoutService(doc, (id) =>
          canvas.computed(id),
        ).autoLayout(selected, "flex"),
      autogrid: () =>
        new global.AgataWebLayout.LayoutService(doc, (id) =>
          canvas.computed(id),
        ).autoLayout(selected, "grid"),
      canvasfit:()=>setZoom("fit-width"),
      canvaszoom:()=>setZoom("custom",100),
      gridguides: () => canvas.gridGuides(selected),
      rulers: () => canvas.rulers(),
      snap: () => {
        canvas.snap = canvas.snap === false;
        status("Snap de tamanho: " + (canvas.snap ? "ativo" : "desativado"));
      },
      group: () => doc.group([...selection]),
      format: () => code.format(),
      find: () => code.find(),
      source: () => code.locate(doc.node(selected)),
      diff: () => {
        const file = activeFile,
          model = code.model(file),
          original = code.monaco.editor.createModel(
            code.savedModels.get(file) || doc.text(file),
            code.language(file),
          );
        const overlay = document.createElement("div");
        overlay.style.cssText =
          "position:fixed;inset:80px 40px;background:#171d29;z-index:999;display:flex;flex-direction:column";
        const close = button("Fechar comparação", () => {
          diff.dispose();
          original.dispose();
          overlay.remove();
        });
        const host = document.createElement("div");
        host.style.cssText = "flex:1;min-height:0";
        overlay.append(close, host);
        root.append(overlay);
        const diff = code.monaco.editor.createDiffEditor(host, {
          automaticLayout: true,
          theme: "vs-dark",
          readOnly: true,
        });
        diff.setModel({ original, modified: model });
      },
      gradient: () => {
        const kind = q("gradient-kind").value,
          stops = q("gradient-stops").value,
          angle = Number(q("gradient-angle").value);
        const value =
          kind +
          "-gradient(" +
          (kind === "linear"
            ? angle + "deg, "
            : kind === "conic"
              ? "from " + angle + "deg, "
              : "circle, ") +
          stops +
          ")";
        if (!CSS.supports("background", value))
          throw Error("Gradiente inválido");
        doc.style(selected, "background", value, q("media").value);
      },
      animation: () => {
        const name = q("animation-name").value;
        if (!/^[a-zA-Z][\w-]*$/.test(name))
          throw Error("Nome de animação inválido");
        const frames = q("animation-frames").value,
          duration = Number(q("animation-duration").value);
        if (!Number.isFinite(duration) || duration <= 0)
          throw Error("Duração inválida");
        const css = "@keyframes " + name + "{" + frames + "}";
        global.AgataWebParsers.css.parse(css);
        doc.style(
          selected,
          "animation",
          name + " " + duration + "s ease-in-out infinite",
        );
        const file = "css/overrides.css";
        doc.edit(
          file,
          doc.text(file) +
            "\n" +
            css +
            '\n@media(prefers-reduced-motion:reduce){[data-agata-id="' +
            selected +
            '"]{animation:none!important}}\n',
          "Criar keyframes",
        );
      },
      event: () => {
        const action = q("event-action").value,
          target = q("event-target").value;
        global.AgataWebEvents.configure(doc, selected, action, target);
      },
      tokens: () => {
        const css = global.AgataWebParsers.css,
          ast = css.parse(q("tokens").value);
        doc.transaction("Atualizar design tokens", () => {
          doc.edit(
            "css/tokens.css",
            q("tokens").value,
            "Atualizar design tokens",
          );
          doc.editMetadata("Sincronizar tokens", (metadata) => {
            const tokens = (metadata.tokens ||= {});
            css.walk(ast, (n) => {
              if (n.type !== "Declaration" || !n.property.startsWith("--"))
                return;
              const parts = n.property.slice(2).split("-");
              if (
                parts.length < 2 ||
                parts.some((p) =>
                  ["__proto__", "constructor", "prototype"].includes(p),
                )
              )
                return;
              let object = tokens;
              for (const part of parts.slice(0, -1)) {
                if (!object[part] || typeof object[part] !== "object")
                  object[part] = {};
                object = object[part];
              }
              const value = css.generate(n.value),
                key = parts.at(-1);
              object[key] =
                n.value.children.size === 1 &&
                ["Number", "Dimension"].includes(n.value.children.first.type)
                  ? Number(n.value.children.first.value)
                  : value;
            });
          });
        });
      },
    };
    on(root, "click", (e) => {
      const b = e.target.closest("[data-action]");
      if (b && actions[b.dataset.action])
        Promise.resolve()
          .then(() => {
            const atomic = ["center", "animation", "event"].includes(
              b.dataset.action,
            );
            return atomic && doc
              ? doc.transaction(b.textContent.trim(), actions[b.dataset.action])
              : actions[b.dataset.action]();
          })
          .catch(fail);
      const mode = e.target.closest("button[data-mode]");
      if (mode) setMode(mode.dataset.mode);
    });
    on(q("search-files"), "input", renderFiles);
    on(q("search-blocks"), "input", () =>
      renderBlocks(q("search-blocks").value),
    );
    on(q("block-category"), "change", () => renderBlocks(q("search-blocks").value));
    on(q("page"), "change", () => {
      page = q("page").value;
      selected = null;
      canvas.render(page);
      renderTree();
      open(page);
      if (mode === "preview") refreshPreview();
    });
    on(q("viewport"), "change", async () => {
      let width = q("viewport").value;
      if (width === "custom")
        width = await ask("Viewport", "Largura em pixels", q("width").value);
      if (width && Number(width) >= 240 && Number(width) <= 3840) {
        q("width").value = width;
        q("width").dispatchEvent(new Event("change"));
      }
    });
    on(q("width"), "change", () => {
      const width = Math.min(3840, Math.max(240, Number(q("width").value)));
      q("width").value = width;
      zoomController?.setViewport(width);
      updateZoomDisplay();
      q("preview").style.width = width + "px";
    });
    on(q("reduced"), "change", () => {
      if (doc)
        doc.editMetadata("Movimento reduzido", (m) => {
          (m.settings ||= {}).reducedMotion = q("reduced").checked;
        });
      if (mode === "preview") refreshPreview();
    });
    on(q("network"), "change", () => {
      if (doc)
        doc.editMetadata("HTTPS no preview", (m) => {
          (m.settings ||= {}).allowHttps = q("network").checked;
        });
      if (mode === "preview") refreshPreview();
    });
    on(q("autosave"), "change", () =>
      doc?.editMetadata("Configurar autosave", (m) => {
        (m.settings ||= {}).autosave = q("autosave").checked;
      }),
    );
    on(q("autosave-interval"), "change", () =>
      doc?.editMetadata("Intervalo autosave", (m) => {
        (m.settings ||= {}).autosaveInterval = Math.min(
          300,
          Math.max(5, Number(q("autosave-interval").value) || 30),
        );
      }),
    );
    on(global, "message", (e) => {
      if (
        e.source !== q("preview").contentWindow ||
        !previewNonce ||
        !e.data ||
        e.data.nonce !== previewNonce ||
        e.data.agataPreview !== 1
      )
        return;
      if (e.data.type === "console" && typeof e.data.data?.text === "string")
        log("Preview: " + e.data.data.text);
      if (e.data.type === "select" && doc.nodes.has(e.data.data?.id))
        select(e.data.data.id, false, {
          includeId:
            doc.nodes.get(e.data.data.includeId)?.tag === "agata-include"
              ? e.data.data.includeId
              : null,
        });
    });
    function keyboard(e) {
      if (!root.isConnected || !doc) return;
      if (
        e.repeat &&
        (e.ctrlKey || e.metaKey) &&
        ["z", "y"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save().catch(fail);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        ["z", "y"].includes(e.key.toLowerCase()) &&
        !e.target.closest(
          ".monaco-editor,input,textarea,select,[contenteditable=true]",
        )
      ) {
        e.preventDefault();
        if (e.shiftKey || e.key.toLowerCase() === "y") doc.history.redo();
        else doc.history.undo();
      }
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.target.closest(
          "input,textarea,select,.monaco-editor,[contenteditable=true]",
        ) &&
        ["ArrowUp", "ArrowDown"].includes(e.key) &&
        selected
      ) {
        e.preventDefault();
        Promise.resolve()
          .then(e.key === "ArrowUp" ? actions.up : actions.down)
          .catch(fail);
      }
    }
    global.addEventListener(
      "keydown",
      (e) => {
        if (
          e.repeat &&
          doc &&
          (e.ctrlKey || e.metaKey) &&
          ["z", "y"].includes(e.key.toLowerCase())
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      { capture: true, signal: abort.signal },
    );
    on(global, "keydown", keyboard);
    on(q("upload"), "change", async () => {
      try {
        for (const file of q("upload").files) {
          if (file.size > 6_000_000) throw Error("Asset excede 6 MB");
          const name = global.AgataWebDomain.path("assets/" + file.name);
          if (doc.files.has(name))
            throw Error("Asset já existe; renomeie o arquivo");
          const data = new Uint8Array(await file.arrayBuffer());
          const content = btoa(
            Array.from(data, (b) => String.fromCharCode(b)).join(""),
          );
          doc.command("Importar asset", [
            {
              file: name,
              before: null,
              after: content,
              afterEncoding: "base64",
            },
          ]);
        }
        changed();
        q("upload").value = "";
      } catch (e) {
        fail(e);
      }
    });
    const previous = global.VelaPage?.beforeUnmount;
    global.VelaPage = {
      beforeUnmount: async () => {
        disposed = true;
        clearTimeout(timer);
        clearTimeout(autosaveTimer);
        if (doc?.dirty)
          try {
            await api("save_web_recovery", doc.project.id, doc.payload());
          } catch (e) {
            console.error(e);
          }
        abort.abort();
        layoutManager?.dispose();
        designObserver.disconnect();
        code?.dispose();
        canvas?.dispose();
        if (previous) await previous();
      },
    };
    await global.AgataWebParsers.ready;
    catalog = await api("web_catalog");
    const response = await fetch(
      root.dataset.assets + "model/html-elements.json",
    );
    const elements = await response.json();
    catalog.elements = elements.elements || elements;
    const categories = [...new Set(availableBlocks().map(b => b.category))].sort();
    q("block-category").replaceChildren(
      new Option("Todas as categorias", "all"),
      ...categories.map(name => new Option(name, name))
    );
    q("project-template").replaceChildren(
      ...catalog.templates.map((t) => new Option(t.name, t.id)),
    );
    const describeTemplate = () => {
      const selected = catalog.templates.find(t => t.id === q("project-template").value);
      q("welcome-template").textContent = selected
        ? "Modelo selecionado: " + selected.name + " · " + selected.category + " · licença " + selected.license + ". Clique em Usar modelo selecionado para criar arquivos editáveis."
        : "Selecione um modelo Web para continuar.";
    };
    on(q("project-template"), "change", describeTemplate);
    describeTemplate();
    if (root.dataset.projectId) await load(root.dataset.projectId);
    else {
      root.dataset.projectState = "empty";
      root.querySelector(".ws-layout").hidden = true;
      q("welcome").hidden = false;
      status("Escolha um template e crie ou importe um projeto");
      for (const control of root.querySelectorAll("input,textarea,select"))
        if (
          !["ws-project-template", "ws-ide-theme"].includes(control.id) &&
          !q("dialog").contains(control)
        )
          control.disabled = true;
      for (const button of root.querySelectorAll("[data-action],[data-mode]"))
        if (!["home", "create", "import"].includes(button.dataset.action)) {
          button.disabled = true;
          button.title = "Crie ou importe um projeto primeiro";
        }
      root.dataset.mode = "design";
    }
    global.AgataWebStudio.actions = actions;
  }
  global.AgataWebStudio = { mount };
})(window);
