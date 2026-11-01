(function (global) {
  "use strict";
  const D = () => global.AgataWebDomain;
  function resolve(from, url) {
    try {
      const base = new URL(from, "https://agata.invalid/"),
        target = new URL(url, base);
      if (target.origin !== base.origin) return null;
      return decodeURIComponent(target.pathname.slice(1));
    } catch {
      return null;
    }
  }
  function asset(doc, from, url) {
    if (
      url.startsWith("#") ||
      url.startsWith("data:") ||
      url.startsWith("blob:")
    )
      return url;
    const file = resolve(from, url),
      entry = doc.files.get(file);
    if (!entry) return "";
    const mime =
      {
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        woff2: "font/woff2",
        woff: "font/woff",
        ttf: "font/ttf",
      }[file.split(".").pop().toLowerCase()] || "application/octet-stream";
    return (
      "data:" +
      mime +
      ";base64," +
      (entry.encoding === "base64"
        ? entry.content
        : btoa(
            Array.from(new TextEncoder().encode(entry.content), (b) =>
              String.fromCharCode(b),
            ).join(""),
          ))
    );
  }
  function stylesheet(doc, file, stack = new Set(), active = new Set()) {
    if (stack.has(file) || !doc.files.has(file)) return "";
    active.add(file);
    const next = new Set([...stack, file]),
      css = global.AgataWebParsers.css;
    try {
      const tree = css.parse(doc.text(file)),
        imports = [];
      css.walk(tree, {
        visit: "Atrule",
        enter(node, item, list) {
          if (node.name !== "import") return;
          const parts = node.prelude?.children.toArray() || [],
            first = parts.shift(),
            url = ["String", "Url"].includes(first?.type) ? first.value : null,
            target = url ? resolve(file, url) : null;
          if (!target || !doc.files.has(target)) return;
          let content = stylesheet(doc, target, next, active);
          let layer = null,
            supports = null;
          while (parts.length) {
            const part = parts[0];
            if (part.type === "Identifier" && part.name === "layer") {
              layer = "";
              parts.shift();
            } else if (part.type === "Function" && part.name === "layer") {
              layer = part.children
                .toArray()
                .map((n) => css.generate(n))
                .join(" ");
              parts.shift();
            } else if (part.type === "Function" && part.name === "supports") {
              supports = part.children
                .toArray()
                .map((n) => css.generate(n))
                .join(" ");
              parts.shift();
            } else break;
          }
          const media = parts.map((n) => css.generate(n)).join(" ");
          if (media) content = "@media " + media + "{" + content + "}";
          if (supports)
            content = "@supports (" + supports + "){" + content + "}";
          if (layer !== null) content = "@layer " + layer + "{" + content + "}";
          imports.push(content);
          list.remove(item);
        },
      });
      css.walk(tree, (node) => {
        if (node.type === "Url") node.value = asset(doc, file, node.value);
      });
      const result = imports.join("\n") + "\n" + css.generate(tree);
      (doc.lastValidStylesheets ||= new Map()).set(file, result);
      return result;
    } catch (error) {
      doc.diagnostics.push({
        file,
        message: "CSS não aplicado: " + error.message,
      });
      return doc.lastValidStylesheets?.get(file) || "";
    }
  }
  function canvasMarkup(doc, file) {
    const parse = global.AgataWebParsers.html,
      seen = new Set();
    let visited = 0;
    const sourceFiles = new Set(),
      activeStylesheets = new Set();
    function render(file, stack) {
      if (stack.includes(file) || stack.length > 12) return "";
      if (!doc.files.has(file)) return "";
      sourceFiles.add(file);
      const ast = parse.parse(doc.text(file));
      const walk = (node, depth = 0) => {
        if (depth > 100 || ++visited > 20000) return "";
        if (node.nodeName === "#text")
          return node.value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
        if (!node.tagName)
          return (node.childNodes || [])
            .map((c) => walk(c, depth + 1))
            .join("");
        const tag = node.tagName;
        if (
          [
            "script",
            "iframe",
            "object",
            "embed",
            "base",
            "meta",
            "link",
            "style",
            "title",
            "template",
            "noscript",
          ].includes(tag)
        )
          return "";
        const attrs = Object.fromEntries(
          (node.attrs || []).map((a) => [a.name, a.value]),
        );
        if (tag === "agata-include") {
          const target = resolve(file, attrs.src || "");
          return (
            '<div data-agata-include="' +
            D().escape(target || "") +
            '" data-agata-id="' +
            D().escape(attrs["data-agata-id"] || "") +
            '" style="display:contents">' +
            (target ? render(target, [...stack, file]) : "") +
            "</div>"
          );
        }
        const out = [];
        for (const [k, v] of Object.entries(attrs)) {
          if (
            /^on/i.test(k) ||
            ["srcdoc", "formaction", "action", "nonce"].includes(k)
          )
            continue;
          if (k === "src" || k === "poster") {
            out.push(k + '="' + D().escape(asset(doc, file, v)) + '"');
            continue;
          }
          if (k === "href" && tag !== "a") continue;
          if (k === "href") {
            out.push('href="#"');
            continue;
          }
          if (k === "style") {
            try {
              const t = global.AgataWebParsers.css.parse(v, {
                context: "declarationList",
              });
              global.AgataWebParsers.css.walk(t, (n) => {
                if (n.type === "Url") n.value = asset(doc, file, n.value);
              });
              out.push(
                'style="' +
                  D().escape(global.AgataWebParsers.css.generate(t)) +
                  '"',
              );
            } catch {}
            continue;
          }
          out.push(k + '="' + D().escape(v) + '"');
        }
        const content = (node.childNodes || [])
          .map((c) => walk(c, depth + 1))
          .join("");
        if (["html", "head", "body"].includes(tag)) return content;
        return (
          "<" +
          tag +
          (out.length ? " " + out.join(" ") : "") +
          ">" +
          (D().voids.has(tag) ? "" : content + "</" + tag + ">")
        );
      };
      return walk(ast);
    }
    const html = render(file, []);
    let css = "";
    for (const f of sourceFiles) {
      const ast = parse.parse(doc.text(f));
      const visit = (n) => {
        const a = Object.fromEntries(
          (n.attrs || []).map((x) => [x.name, x.value]),
        );
        if (n.tagName === "link" && a.rel === "stylesheet") {
          const p = resolve(f, a.href);
          if (p) css += "\n" + stylesheet(doc, p, new Set(), activeStylesheets);
        }
        if (n.tagName === "style") {
          try {
            const tree = global.AgataWebParsers.css.parse(
              (n.childNodes || []).map((x) => x.value || "").join(""),
            );
            global.AgataWebParsers.css.walk(tree, (x) => {
              if (x.type === "Url") x.value = asset(doc, f, x.value);
            });
            css += "\n" + global.AgataWebParsers.css.generate(tree);
          } catch {}
        }
        for (const c of n.childNodes || []) visit(c);
      };
      visit(ast);
    }
    return { html, css, activeStylesheets };
  }
  class MonacoAdapter {
    constructor(host, doc, onFile) {
      this.doc = doc;
      this.onFile = onFile;
      this.models = new Map();
      this.savedModels = new Map();
      this.suppress = false;
      this.monaco = global.AgataMonacoVendor;
      this.editor = this.monaco.editor.create(host, {
        theme: (() => { const selected = localStorage.getItem("agata-ide-theme") || "system"; return selected === "light" || (selected === "system" && !matchMedia("(prefers-color-scheme: dark)").matches) ? "vs" : "vs-dark"; })(),
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 13,
        tabSize: 2,
        wordWrap: "on",
        scrollBeyondLastLine: false,
      });
      this.editor.addCommand(
        this.monaco.KeyMod.CtrlCmd | this.monaco.KeyCode.KeyZ,
        () => doc.history.undo(),
      );
      this.editor.addCommand(
        this.monaco.KeyMod.CtrlCmd |
          this.monaco.KeyMod.Shift |
          this.monaco.KeyCode.KeyZ,
        () => doc.history.redo(),
      );
      this.editor.addCommand(
        this.monaco.KeyMod.CtrlCmd | this.monaco.KeyCode.KeyY,
        () => doc.history.redo(),
      );
      this.unsubscribe = doc.subscribe(() => this.sync());
      this.markerSubscription = this.monaco.editor.onDidChangeMarkers(() => {
        this.onDiagnostics?.(
          this.monaco.editor
            .getModelMarkers({})
            .filter((m) => m.resource.authority === doc.project.id)
            .map((m) => ({
              file: m.resource.path.slice(1),
              line: m.startLineNumber,
              message: m.message,
            })),
        );
      });
      this.editor.onDidChangeCursorPosition((event) => {
        if (this.suppress || !/\.html?$/i.test(this.file || "")) return;
        const offset = this.editor.getModel()?.getOffsetAt(event.position);
        const nodes = [...doc.nodes.values()]
          .filter(
            (n) => n.file === this.file && n.start <= offset && n.end >= offset,
          )
          .sort((a, b) => a.end - a.start - (b.end - b.start));
        if (nodes[0]) this.onNode?.(nodes[0].id);
      });
    }
    language(file) {
      return (
        {
          html: "html",
          htm: "html",
          css: "css",
          js: "javascript",
          mjs: "javascript",
          json: "json",
          md: "markdown",
          svg: "xml",
        }[file.split(".").pop().toLowerCase()] || "plaintext"
      );
    }
    model(file) {
      if (!this.models.has(file)) {
        const uri = this.monaco.Uri.from({
          scheme: "agata",
          authority: this.doc.project.id,
          path: "/" + file,
        });
        const old = this.monaco.editor.getModel(uri);
        if (old) old.dispose();
        const model = this.monaco.editor.createModel(
          this.doc.text(file),
          this.language(file),
          uri,
        );
        model.updateOptions({ tabSize: 2, insertSpaces: true });
        model.onDidChangeContent(() => {
          if (!this.suppress) {
            this.doc.transaction("Editar código", () => {
              this.doc.edit(file, model.getValue());
              if (/\.html?$/i.test(file)) this.doc.normalize();
            });
          }
        });
        this.models.set(file, model);
      }
      return this.models.get(file);
    }
    open(file) {
      this.file = file;
      this.editor.setModel(this.model(file));
      this.onFile(file);
    }
    sync() {
      this.suppress = true;
      try {
        for (const [file, model] of this.models) {
          if (!this.doc.files.has(file)) {
            if (this.file === file) this.editor.setModel(null);
            model.dispose();
            this.models.delete(file);
            continue;
          }
          const src = this.doc.text(file);
          if (model.getValue() !== src) {
            const d = D().diff(model.getValue(), src);
            const a = model.getPositionAt(d.start),
              b = model.getPositionAt(d.start + d.removed.length);
            model.applyEdits([
              {
                range: new this.monaco.Range(
                  a.lineNumber,
                  a.column,
                  b.lineNumber,
                  b.column,
                ),
                text: d.inserted,
              },
            ]);
          }
        }
      } finally {
        this.suppress = false;
      }
    }
    locate(node) {
      this.open(node.file);
      const model = this.model(node.file),
        a = model.getPositionAt(node.start),
        b = model.getPositionAt(node.end);
      this.editor.setSelection(
        new this.monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column),
      );
      this.editor.revealLineInCenter(a.lineNumber);
    }
    format() {
      return this.editor.getAction("editor.action.formatDocument").run();
    }
    gotoLine(){
      this.editor.focus();
      return this.editor.getAction("editor.action.gotoLine").run();
    }
    find() {
      this.editor.focus();
      this.editor.getAction("editor.action.startFindReplaceAction").run();
    }
    dispose() {
      this.unsubscribe();
      this.markerSubscription.dispose();
      this.editor.dispose();
      for (const m of this.models.values()) m.dispose();
    }
  }
  class CanvasAdapter {
    constructor(host, doc, onSelect, onError) {
      this.doc = doc;
      this.onSelect = onSelect;
      this.onError = onError;
      this.suppress = false;
      this.editor = global.grapesjs.init({
        container: host,
        height: "100%",
        width: "auto",
        storageManager: false,
        telemetry: false,
        noticeOnUnload: false,
        fromElement: false,
        panels: { defaults: [] },
        undoManager: false,
        selectorManager: { componentFirst: true },
        canvas: { scripts: [], styles: [] },
        cssIcons: "",
        showOffsets: true,
      });
      this.editor.UndoManager.stop();
      this.editor.on("canvas:frame:load", () => {
        this.secure();
        this.applyAuthoredStyle();
        requestAnimationFrame(()=>this.applyAuthoredStyle());
      });
      this.editor.on("component:selected", (component) => {
        if (!this.suppress) {
          const id = component.getAttributes()["data-agata-id"];
          if (id && doc.nodes.has(id)) {
            let includeId = null;
            for (
              let parent = component.parent();
              parent;
              parent = parent.parent()
            ) {
              if (parent.getAttributes()["data-agata-include"]) {
                includeId = parent.getAttributes()["data-agata-id"];
                break;
              }
            }
            onSelect(id, this.editor.getSelectedAll().length > 1, {
              includeId,
            });
          }
        }
      });
      this.editor.on("component:drag:end", (target) => {
        if (this.suppress) return;
        try {
          const component = target?.target || target;
          if (!component?.getAttributes) return;
          const id = component.getAttributes()["data-agata-id"],
            parent = component.parent(),
            parentId = parent?.getAttributes()["data-agata-id"] || null,
            next = component.collection?.at(component.index() + 1),
            before = next?.getAttributes()["data-agata-id"] || null;
          if (id && doc.nodes.has(id)) doc.move(id, parentId, before);
          else {
            const block = component.getAttributes()["data-agata-block"];
            if (block) {
              const html = this.blocks?.get(block);
              if (html) {
                if (this.onInsert) this.onInsert(block, parentId, before);
                else doc.insert(this.file, parentId, html, before);
              }
            }
          }
        } catch (e) {
          onError(e);
          this.render(this.file);
        }
      });
      this.editor.on("component:update:content", (component) => {
        if (this.suppress) return;
        try {
          const id = component.getAttributes()["data-agata-id"];
          if (!id || !doc.nodes.has(id)) return;
          const node = doc.node(id);
          if (node.children.length || !node.endTag) return;
          const content = component.get("content");
          if (typeof content !== "string") return;
          const parsed = global.AgataWebParsers.html.parseFragment(content);
          if (parsed.childNodes.some((n) => n.tagName)) return;
          const src = doc.text(node.file);
          doc.edit(
            node.file,
            src.slice(0, node.startTag.endOffset) +
              content +
              src.slice(node.endTag.startOffset),
            "Editar texto",
          );
        } catch (e) {
          onError(e);
        }
      });
      this.editor.on("component:resize", (options) => {
        if (!this.suppress)
          this.pendingResize = options?.component || this.editor.getSelected();
      });
      this.finishResize = () => {
        const component = this.pendingResize;
        this.pendingResize = null;
        if (!component) return;
        try {
          const id = component.getAttributes()["data-agata-id"];
          if (!id || !doc.nodes.has(id)) return;
          const style = { ...component.getStyle() },
            element = component.getEl(),
            peers = [...(element?.parentElement?.children || [])].filter(
              (e) => e !== element,
            );
          if (this.snap !== false && this.interaction?.snap !== false) {
            const threshold = 6 / (this.editor.Canvas.getZoom() / 100);
            for (const property of ["width", "height"]) {
              const value = parseFloat(style[property]);
              if (
                !Number.isFinite(value) ||
                !String(style[property]).endsWith("px")
              )
                continue;
              const choices = [
                Math.round(value / (this.interaction?.spacing || 8)) * (this.interaction?.spacing || 8),
                ...peers.map((e) =>
                  parseFloat(
                    e.ownerDocument.defaultView.getComputedStyle(e)[property],
                  ),
                ),
              ].filter(Number.isFinite);
              choices.sort((a, b) => Math.abs(a - value) - Math.abs(b - value));
              if (Math.abs(choices[0] - value) <= threshold)
                style[property] = choices[0] + "px";
            }
          }
          const ratio = element
            ? element.ownerDocument.defaultView
                .getComputedStyle(element)
                .aspectRatio.split("/")
                .map(Number)
            : [];
          if (
            ratio.length === 2 &&
            ratio.every((v) => Number.isFinite(v) && v > 0) &&
            String(style.width).endsWith("px")
          )
            style.height =
              (parseFloat(style.width) * ratio[1]) / ratio[0] + "px";
          doc.transaction("Redimensionar elemento", () => {
            for (const property of ["width", "height"])
              if (style[property] && CSS.supports(property, style[property]))
                doc.style(id, property, style[property]);
          });
        } catch (error) {
          onError(error);
        }
      };
      global.addEventListener("pointerup", this.finishResize);
      global.addEventListener("mouseup", this.finishResize);
      this.editor.Keymaps.removeAll();
    }
    secure() {
      const frame = this.editor.Canvas.getFrameEl();
      if (frame) {
        if(this.styleBoundFrame!==frame){
          this.styleBoundFrame?.removeEventListener("load",this.frameLoadCallback);
          this.styleBoundFrame=frame;
          this.frameLoadCallback=()=>{
            this.secure();
            requestAnimationFrame(()=>this.applyAuthoredStyle());
          };
          frame.addEventListener("load",this.frameLoadCallback);
        }
        frame.setAttribute("sandbox", "allow-same-origin");
        // GrapesJS may replace the iframe document after setComponents or when
        // changing device dimensions. Restore authored CSS on EVERY frame load;
        // the project CSS never becomes a workspace/editor stylesheet.
        this.applyAuthoredStyle();
        const head = frame.contentDocument?.head;
        if (head && !head.querySelector("[data-agata-csp]")) {
          const meta = frame.contentDocument.createElement("meta");
          meta.dataset.agataCsp = "1";
          meta.httpEquiv = "Content-Security-Policy";
          meta.content =
            "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; script-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
          head.prepend(meta);
        }
        const document = frame.contentDocument;
        if (document) {
          document.onkeydown = (e) => this.onKeyDown?.(e);
          document.onpointerup = this.finishResize;
          document.onmouseup = this.finishResize;
          document.ondragover = (e) => {
            if (
              e.dataTransfer?.types.includes("application/agata-block") ||
              e.dataTransfer?.types.includes("application/agata-node")
            ) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              const target = e.target.closest("[data-agata-id]");
              if (this.dropTarget && this.dropTarget !== target)
                this.dropTarget.style.outline = "";
              this.dropTarget = target;
              if (target) target.style.outline = "2px dashed #6750A4";
            }
          };
          document.ondrop = (e) => {
            const block = e.dataTransfer?.getData("application/agata-block"),
              moving = e.dataTransfer?.getData("application/agata-node");
            if (!block && !moving) return;
            e.preventDefault();
            e.stopPropagation();
            if (this.dropTarget) this.dropTarget.style.outline = "";
            try {
              let target = e.target.closest("[data-agata-id]");
              let parentId = target?.dataset.agataId || null,
                beforeId = null;
              if (parentId && this.doc.nodes.has(parentId)) {
                const n = this.doc.node(parentId),
                  rect = target.getBoundingClientRect(),
                  relative = (e.clientY - rect.top) / Math.max(rect.height, 1);
                if (
                  relative < 0.25 ||
                  relative > 0.75 ||
                  !this.doc.canContain(
                    n.tag,
                    moving ? this.doc.node(moving).tag : "div",
                  )
                ) {
                  parentId = n.parent?.id || null;
                  beforeId =
                    relative < 0.5
                      ? n.id
                      : n.parent?.children[n.parent.children.indexOf(n) + 1]
                          ?.id || null;
                }
              }
              if (moving) this.doc.move(moving, parentId, beforeId);
              else {
                const html = this.blocks?.get(block);
                if (html) {
                  if (this.onInsert) this.onInsert(block, parentId, beforeId);
                  else this.doc.insert(this.file, parentId, html, beforeId);
                }
              }
            } catch (error) {
              this.onError(error);
            }
          };
          document.ondragleave = () => {
            if (this.dropTarget) this.dropTarget.style.outline = "";
          };
        }
        this.interaction?.bindFrame();
      }
    }
    applyAuthoredStyle() {
      const document=this.editor.Canvas.getDocument();
      if(!document?.head||typeof this.previewCss!=="string")return;
      let style=document.getElementById("agata-authored-css");
      if(!style){
        style=document.createElement("style");
        style.id="agata-authored-css";
        document.head.append(style);
      }
      if(style.textContent!==this.previewCss)style.textContent=this.previewCss;
    }
    render(file) {
      if (!file) return;
      this.file = file;
      this.suppress = true;
      try {
        const { html, css, activeStylesheets } = canvasMarkup(this.doc, file);
        this.activeStylesheets = activeStylesheets;
        if (this.previousFile !== file) {
          this.editor.setComponents(html);
        } else if (this.previousHtml !== html) {
          const parsed = this.editor.Parser.parseHtml(html, {
            allowScripts: false,
            allowUnsafeAttr: false,
          });
          const keyed = new Map();
          this.editor.getWrapper().onAll((c) => {
            const id = c.getAttributes()["data-agata-id"];
            if (id) keyed.set(id, c);
          });
          const reconcile = (parent, definitions) => {
            const keep = [];
            for (const [index, definition] of definitions.entries()) {
              if (typeof definition === "string") {
                const child = parent.components().at(index);
                if (child?.is("textnode")) {
                  child.set("content", definition);
                  keep.push(child);
                } else
                  keep.push(
                    parent
                      .components()
                      .add(
                        { type: "textnode", content: definition },
                        { at: index },
                      ),
                  );
                continue;
              }
              const id = definition.attributes?.["data-agata-id"];
              let child = id ? keyed.get(id) : null;
              if (!child) {
                child = parent.components().add(definition, { at: index });
              } else {
                if (child.parent() !== parent || child.index() !== index)
                  child.move(parent, { at: index });
                const { components: children, ...properties } = definition;
                child.set(properties);
                child.setAttributes(definition.attributes || {});
                if (Array.isArray(definition.components))
                  reconcile(child, definition.components);
              }
              keep.push(child);
            }
            for (const child of [...parent.components().models])
              if (!keep.includes(child)) child.remove();
          };
          reconcile(
            this.editor.getWrapper(),
            Array.isArray(parsed.html) ? parsed.html : [parsed.html],
          );
        }
        this.previousFile = file;
        this.previousHtml = html;
        this.previewCss=css;
        this.editor.setStyle("");
        this.secure();
        this.applyAuthoredStyle();
        this.width(this.logicalWidth || 1440);
        // Device selection can recreate the frame AFTER the synchronous CSS
        // injection. Reapply after GrapesJS has completed that DOM pass.
        requestAnimationFrame(()=>this.applyAuthoredStyle());
        this.editor.getWrapper().onAll((component) => {
          component.set({
            removable: false,
            copyable: false,
            stylable: false,
            resizable: true,
          });
        });
      } finally {
        this.suppress = false;
      }
    }
    width(value) {
      this.logicalWidth = value;
      let device = this.editor.Devices.get("agata-viewport");
      if (!device)
        device = this.editor.Devices.add({
          id: "agata-viewport",
          name: "Agata viewport",
          width: value + "px",
        });
      else device.set("width", value + "px");
      this.editor.Devices.select(device);
      // Width is a CSS media-query viewport. Only CanvasZoomController may
      // change visual zoom; re-render must never silently reset 35% or 150%.
    }
    select(id, append = false, includeId = null) {
      const component = this.editor
        .getWrapper()
        .find(
          (includeId ? '[data-agata-id="' + includeId + '"] ' : "") +
            '[data-agata-id="' +
            id +
            '"]',
        )[0];
      if (component) {
        if (append) this.editor.selectAdd(component);
        else this.editor.select(component);
      }
    }
    locate(id){
      const frame=this.editor.Canvas.getFrameEl();
      const el=frame?.contentDocument?.querySelector('[data-agata-id="'+id+'"]');
      if(!el)return;
      el.scrollIntoView({block:"center",inline:"center",behavior:"instant"});
      this.select(id);
    }
    rulers() {
      const document = this.editor.Canvas.getDocument();
      if (!document) return;
      const old = document.getElementById("agata-rulers");
      if (old) {
        old.remove();
        return;
      }
      const width = this.logicalWidth || 1440,
        height = document.documentElement.clientHeight,
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "agata-rulers";
      svg.setAttribute("width", width);
      svg.setAttribute("height", height);
      svg.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:999999";
      for (let x = 0; x < width; x += 10) {
        const tick = document.createElementNS(svg.namespaceURI, "line");
        tick.setAttribute("x1", x);
        tick.setAttribute("x2", x);
        tick.setAttribute("y1", 0);
        tick.setAttribute("y2", x % 100 ? 4 : 12);
        tick.setAttribute("stroke", "#6750a4");
        svg.append(tick);
        if (x % 100 === 0) {
          const text = document.createElementNS(svg.namespaceURI, "text");
          text.setAttribute("x", x + 3);
          text.setAttribute("y", 12);
          text.setAttribute("font-size", 9);
          text.setAttribute("fill", "#6750a4");
          text.textContent = x;
          svg.append(text);
        }
      }
      for (let y = 0; y < height; y += 10) {
        const tick = document.createElementNS(svg.namespaceURI, "line");
        for (const [key, value] of Object.entries({
          x1: 0,
          x2: y % 100 ? 4 : 12,
          y1: y,
          y2: y,
          stroke: "#6750a4",
        }))
          tick.setAttribute(key, value);
        svg.append(tick);
      }
      document.body.append(svg);
    }
    gridGuides(id) {
      const document = this.editor.Canvas.getDocument();
      if (!document) return;
      const old = document.getElementById("agata-grid-guides");
      if (old) {
        old.remove();
        return;
      }
      const el = document.querySelector('[data-agata-id="' + id + '"]');
      if (!el) return;
      const style = document.defaultView.getComputedStyle(el);
      if (!style.display.includes("grid")) throw Error("Selecione um CSS Grid");
      const rect = el.getBoundingClientRect(),
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "agata-grid-guides";
      svg.setAttribute("width", rect.width);
      svg.setAttribute("height", rect.height);
      svg.style.cssText =
        "position:absolute;pointer-events:none;z-index:99999;left:" +
        (rect.left + document.defaultView.scrollX) +
        "px;top:" +
        (rect.top + document.defaultView.scrollY) +
        "px";
      const line = (x1, y1, x2, y2) => {
        const node = document.createElementNS(svg.namespaceURI, "line");
        for (const [k, v] of Object.entries({
          x1,
          y1,
          x2,
          y2,
          stroke: "#9359e8",
          "stroke-width": 1,
          "stroke-dasharray": "5 4",
        }))
          node.setAttribute(k, v);
        svg.append(node);
      };
      const cols = style.gridTemplateColumns.split(" ").map(parseFloat),
        rows = style.gridTemplateRows.split(" ").map(parseFloat);
      let x = parseFloat(style.paddingLeft) || 0,
        y = parseFloat(style.paddingTop) || 0;
      for (const col of cols) {
        if (!Number.isFinite(col)) continue;
        line(x, 0, x, rect.height);
        x += col;
        line(x, 0, x, rect.height);
        x += parseFloat(style.columnGap) || 0;
      }
      for (const row of rows) {
        if (!Number.isFinite(row)) continue;
        line(0, y, rect.width, y);
        y += row;
        line(0, y, rect.width, y);
        y += parseFloat(style.rowGap) || 0;
      }
      document.body.append(svg);
    }
    simulate(id, state) {
      const document = this.editor.Canvas.getDocument();
      if (!document) return;
      for (const el of document.querySelectorAll("[data-agata-simulated]"))
        el.removeAttribute("data-agata-simulated");
      let sheet = document.getElementById("agata-simulation");
      if (!sheet) {
        sheet = document.createElement("style");
        sheet.id = "agata-simulation";
        document.head.append(sheet);
      }
      sheet.textContent = "";
      if (
        !id ||
        !["hover", "focus", "active", "disabled", "checked"].includes(state)
      )
        return;
      const target = document.querySelector('[data-agata-id="' + id + '"]');
      if (!target) return;
      target.dataset.agataSimulated = state;
      const css = global.AgataWebParsers.css,
        source =
          document.getElementById("agata-authored-css")?.textContent || "";
      try {
        const ast = css.parse(source);
        css.walk(ast, {
          visit: "PseudoClassSelector",
          enter(node, item, list) {
            if (node.name === state)
              list.replace(
                item,
                list.createItem(
                  css.parse('[data-agata-simulated="' + state + '"]', {
                    context: "selector",
                  }).children.first,
                ),
              );
          },
        });
        sheet.textContent = css.generate(ast);
      } catch {}
    }
    computed(id, includeId = null) {
      const el = this.editor.Canvas.getDocument()?.querySelector(
        '[data-agata-id="' + id + '"]',
      );
      return el ? el.ownerDocument.defaultView.getComputedStyle(el) : null;
    }
    dispose() {
      global.removeEventListener("pointerup", this.finishResize);
      global.removeEventListener("mouseup", this.finishResize);
      this.styleBoundFrame?.removeEventListener("load",this.frameLoadCallback);
      this.editor.destroy();
    }
  }
  async function previewFiles(doc, reduced) {
    await global.AgataWebParsers.ready;
    const result = Object.fromEntries(
      [...doc.files].map(([p, e]) => [p, { ...e }]),
    );
    const parse = global.AgataWebParsers.html;
    for (const [file, entry] of Object.entries(result)) {
      if (entry.encoding !== "utf8") continue;
      const prefix = "../".repeat(file.split("/").length - 1);
      if (/\.css$/i.test(file)) {
        try {
          const ast = global.AgataWebParsers.css.parse(entry.content, {
            positions: true,
          });
          const patches = [];
          global.AgataWebParsers.css.walk(ast, (n) => {
            if (
              n.type === "Url" &&
              n.value.startsWith("/") &&
              !n.value.startsWith("//")
            )
              patches.push({
                start: n.loc.start.offset,
                end: n.loc.end.offset,
                text: "url(" + JSON.stringify(prefix + n.value.slice(1)) + ")",
              });
            if (n.type === "Atrule" && n.name === "import") {
              const value = n.prelude?.children.first;
              if (
                value?.type === "String" &&
                value.value.startsWith("/") &&
                !value.value.startsWith("//")
              )
                patches.push({
                  start: value.loc.start.offset,
                  end: value.loc.end.offset,
                  text: JSON.stringify(prefix + value.value.slice(1)),
                });
            }
          });
          let content = entry.content;
          for (const p of patches.sort((a, b) => b.start - a.start))
            content = content.slice(0, p.start) + p.text + content.slice(p.end);
          result[file] = { ...entry, content };
        } catch {}
      }
      if (/\.m?js$/.test(file)) {
        try {
          const [imports] = global.AgataWebParsers.modules(entry.content),
            patches = [];
          for (const imp of imports)
            if (imp.n?.startsWith("/") && !imp.n.startsWith("//"))
              patches.push({
                start: imp.s,
                end: imp.e,
                text:
                  imp.d === -1
                    ? prefix + imp.n.slice(1)
                    : JSON.stringify(prefix + imp.n.slice(1)),
              });
          let content = entry.content;
          for (const p of patches.sort((a, b) => b.start - a.start))
            content = content.slice(0, p.start) + p.text + content.slice(p.end);
          result[file] = { ...entry, content };
        } catch {}
      }
    }
    for (const [file, entry] of Object.entries(result)) {
      if (entry.encoding !== "utf8" || !/\.html?$/i.test(file)) continue;
      const ast = parse.parse(entry.content, { sourceCodeLocationInfo: true }),
        patches = [];
      const visit = (n) => {
        const loc = n.sourceCodeLocation;
        for (const a of n.attrs || [])
          if (
            ["src", "href", "poster"].includes(a.name) &&
            a.value.startsWith("/") &&
            !a.value.startsWith("//")
          ) {
            const range = loc?.attrs?.[a.name];
            if (range) {
              const url =
                "../".repeat(file.split("/").length - 1) + a.value.slice(1);
              patches.push({
                start: range.startOffset,
                end: range.endOffset,
                text: a.name + '="' + D().escape(url) + '"',
              });
            }
          }
        for (const c of n.childNodes || []) visit(c);
      };
      visit(ast);
      if (reduced) {
        let offset = entry.content.length;
        const find = (n) => {
          if (n.tagName === "head" && n.sourceCodeLocation?.endTag)
            offset = n.sourceCodeLocation.endTag.startOffset;
          for (const c of n.childNodes || []) find(c);
        };
        find(ast);
        patches.push({
          start: offset,
          end: offset,
          text: "<style>*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}</style>",
        });
      }
      let html = entry.content;
      for (const p of patches.sort((a, b) => b.start - a.start))
        html = html.slice(0, p.start) + p.text + html.slice(p.end);
      result[file] = { ...entry, content: html };
    }
    return result;
  }
  global.AgataWebAdapters = {
    MonacoAdapter,
    CanvasAdapter,
    canvasMarkup,
    previewFiles,
    resolve,
  };
})(window);
