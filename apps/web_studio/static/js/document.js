/* Source files are authoritative. Commands retain changed ranges, not project snapshots. */
(function (global) {
  "use strict";
  const uuid = () => global.crypto.randomUUID().replaceAll("-", "");
  function path(value) {
    if (
      typeof value !== "string" ||
      !value ||
      value.length > 240 ||
      /[\\:\x00-\x1f]/.test(value) ||
      value.startsWith("/") ||
      value.split("/").some((p) => !p || p.startsWith("."))
    )
      throw Error("Caminho inválido");
    return value;
  }
  const escape = (v) =>
    String(v)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  const voids = new Set(
    "area base br col embed hr img input link meta param source track wbr".split(
      " ",
    ),
  );
  const nonvisual = new Set(
    "html head body title meta link base script style template noscript source track".split(
      " ",
    ),
  );
  function diff(before, after) {
    let start = 0;
    while (
      start < before.length &&
      start < after.length &&
      before[start] === after[start]
    )
      start++;
    let a = before.length,
      b = after.length;
    while (a > start && b > start && before[a - 1] === after[b - 1]) {
      a--;
      b--;
    }
    return {
      start,
      removed: before.slice(start, a),
      inserted: after.slice(start, b),
    };
  }
  class History {
    constructor(apply) {
      this.apply = apply;
      this.past = [];
      this.future = [];
    }
    execute(command) {
      this.apply(command, false);
      this.past.push(command);
      if (this.past.length > 300) this.past.shift();
      this.future = [];
    }
    undo() {
      const c = this.past.at(-1);
      if (c) {
        this.apply(c, true);
        this.past.pop();
        this.future.push(c);
      }
      return c;
    }
    redo() {
      const c = this.future.at(-1);
      if (c) {
        this.apply(c, false);
        this.future.pop();
        this.past.push(c);
      }
      return c;
    }
  }
  class WebDocument {
    constructor(snapshot, parsers, ports = {}) {
      this.references = ports.references || null;
      this.parsers = parsers;
      this.project = snapshot.project;
      this.metadata = structuredClone(snapshot.project.web_document);
      this.revision = snapshot.revision;
      this.metadataBaseline = JSON.stringify(this.metadata);
      this.files = new Map(
        Object.entries(snapshot.files).map(([p, e]) => [
          p,
          { ...e, version: 0 },
        ]),
      );
      this.baseline = new Map(
        Object.entries(snapshot.files).map(([p, e]) => [p, e.sha256]),
      );
      this.baselineContent = new Map(
        Object.entries(snapshot.files).map(([p, e]) => [
          p,
          { content: e.content, encoding: e.encoding },
        ]),
      );
      this.nodes = new Map();
      this.astCache = new Map();
      this.listeners = new Set();
      this.diagnostics = [];
      this.history = new History((c, reverse) => this.apply(c, reverse));
      this.index();
    }
    text(p) {
      const e = this.files.get(p);
      if (!e || e.encoding !== "utf8")
        throw Error("Arquivo textual inexistente: " + p);
      return e.content;
    }
    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }
    emit(command) {
      if (this.transactionState) return;
      for (const fn of this.listeners) fn(command);
    }
    index() {
      this.nodes.clear();
      this.diagnostics = [];
      let visited = 0;
      for (const [file, e] of this.files) {
        if (e.encoding !== "utf8" || !/\.html?$/i.test(file)) continue;
        const errors = [];
        let cached = this.astCache.get(file);
        if (!cached || cached.content !== e.content) {
          const ast = this.parsers.html.parse(e.content, {
            sourceCodeLocationInfo: true,
            onParseError: (x) => {
              if (x.code !== "missing-doctype") errors.push(x);
            },
          });
          cached = { content: e.content, ast, errors };
          this.astCache.set(file, cached);
        }
        const ast = cached.ast;
        errors.push(...(cached.errors === errors ? [] : cached.errors));
        const visit = (node, parent, depth = 0) => {
          if (depth > 100 || ++visited > 20000) {
            if (!this.diagnostics.some((d) => d.code === "canvas-limit"))
              this.diagnostics.push({
                code: "canvas-limit",
                file,
                message:
                  "Canvas limitado a 20.000 nós / 100 níveis. O código original foi preservado.",
              });
            return;
          }
          const loc = node.sourceCodeLocation;
          let current = parent;
          if (node.tagName && loc) {
            const attrs = Object.fromEntries(
              (node.attrs || []).map((a) => [a.name, a.value]),
            );
            const id = attrs["data-agata-id"];
            const value = {
              id,
              tag: node.tagName,
              attributes: attrs,
              file,
              start: loc.startOffset,
              end: loc.endOffset,
              startTag: loc.startTag,
              endTag: loc.endTag,
              parent,
              children: [],
              location: loc,
            };
            if (id) {
              if (this.nodes.has(id))
                this.diagnostics.push({
                  file,
                  message: "Identidade duplicada: " + id,
                });
              else this.nodes.set(id, value);
            }
            current = value;
            if (parent) parent.children.push(value);
          }
          for (const c of node.childNodes || []) visit(c, current, depth + 1);
        };
        visit(ast, null);
        for (const e of errors)
          this.diagnostics.push({ file, line: e.startLine, message: e.code });
      }
    }
    toInterfaceModel() {
      return {
        version: 1,
        platform: "web",
        metadata: { id: this.project.id, name: this.project.name },
        files: [...this.files.keys()],
        assets: [...this.files.keys()].filter(
          (p) =>
            this.files.get(p).encoding === "base64" || p.startsWith("assets/"),
        ),
        designTokens: structuredClone(this.metadata.tokens || {}),
        components: structuredClone(this.metadata.components || {}),
        pages: [...this.files.keys()].filter(
          (p) => /\.html?$/i.test(p) && !p.startsWith("components/"),
        ),
        nodes: [...this.nodes.values()].map((n) => ({
          id: n.id,
          type: n.tag === "agata-include" ? "component-instance" : "element",
          tagOrComponent: n.tag,
          attributes: { ...n.attributes },
          parent: n.parent?.id || null,
          children: n.children.map((c) => c.id).filter(Boolean),
          styleReferences: (n.attributes.class || "")
            .split(/\s+/)
            .filter(Boolean),
          sourceMappings: {
            file: n.file,
            start: n.start,
            end: n.end,
            line: n.location.startLine,
          },
          metadata:
            n.tag === "agata-include" ? { definition: n.attributes.src } : {},
        })),
      };
    }
    detachComponent(includeId) {
      const instance = this.node(includeId);
      if (instance.tag !== "agata-include")
        throw Error("Selecione uma instância de componente");
      const path = decodeURIComponent(
        new URL(
          instance.attributes.src,
          "https://agata.invalid/" + instance.file,
        ).pathname.slice(1),
      );
      const fragment = this.text(path),
        ast = this.parsers.html.parseFragment(fragment, {
          sourceCodeLocationInfo: true,
        });
      const patches = [];
      const rebase = (value) => {
        if (
          !value ||
          value.startsWith("#") ||
          value.startsWith("/") ||
          /^[a-z][a-z0-9+.-]*:/i.test(value)
        )
          return value;
        const url = new URL(value, "https://agata.invalid/" + path),
          target = decodeURIComponent(url.pathname.slice(1));
        return (
          (this.references?.relative(instance.file, target) || "/" + target) +
          url.search +
          url.hash
        );
      };
      let scripts = false;
      const visit = (n) => {
        if (n.tagName === "script") scripts = true;
        for (const attr of n.attrs || []) {
          let value = attr.value;
          if (["src", "href", "poster"].includes(attr.name))
            value = rebase(value);
          if (attr.name === "style") {
            const style = this.parsers.css.parse(value, {
              context: "declarationList",
            });
            let changed = false;
            this.parsers.css.walk(style, (node) => {
              if (node.type === "Url") {
                const result = rebase(node.value);
                if (result !== node.value) {
                  node.value = result;
                  changed = true;
                }
              }
            });
            if (changed) value = this.parsers.css.generate(style);
          }
          if (attr.name === "srcset")
            throw Error(
              "srcset exige revisão manual antes de desvincular; a definição foi preservada",
            );
          const range = n.sourceCodeLocation?.attrs?.[attr.name];
          if (value !== attr.value && range)
            patches.push({
              start: range.startOffset,
              end: range.endOffset,
              text: attr.name + '="' + escape(value) + '"',
            });
        }
        for (const c of n.childNodes || []) visit(c);
      };
      visit(ast);
      if (scripts)
        throw Error(
          "Componente com scripts: preserve a origem e edite o arquivo diretamente",
        );
      let content = fragment;
      for (const patch of patches.sort((a, b) => b.start - a.start))
        content =
          content.slice(0, patch.start) + patch.text + content.slice(patch.end);
      const src = this.text(instance.file),
        html =
          '<div data-agata-id="' +
          uuid() +
          '">' +
          this.identify(content) +
          "</div>";
      this.edit(
        instance.file,
        src.slice(0, instance.start) + html + src.slice(instance.end),
        "Desvincular instância",
      );
    }
    normalize() {
      const changes = [];
      for (const [file, e] of this.files) {
        if (e.encoding !== "utf8" || !/\.html?$/i.test(file)) continue;
        const ast = this.parsers.html.parse(e.content, {
          sourceCodeLocationInfo: true,
        });
        const patches = [];
        const seen = new Set();
        let visited = 0;
        const visit = (node, depth = 0) => {
          if (depth > 100 || ++visited > 20000) return;
          const loc = node.sourceCodeLocation;
          if (node.tagName && loc?.startTag && !nonvisual.has(node.tagName)) {
            const a = (node.attrs || []).find(
              (x) => x.name === "data-agata-id",
            );
            if (
              !a ||
              !/^[a-zA-Z0-9_-]{1,100}$/.test(a.value) ||
              seen.has(a.value) ||
              this.nodes.get(a.value)?.file !== file
            ) {
              if (a && loc.attrs?.["data-agata-id"]) {
                const x = loc.attrs["data-agata-id"];
                patches.push({
                  start: x.startOffset,
                  end: x.endOffset,
                  text: 'data-agata-id="' + uuid() + '"',
                });
              } else {
                const at =
                  loc.startTag.endOffset -
                  (e.content[loc.startTag.endOffset - 2] === "/" ? 2 : 1);
                patches.push({
                  start: at,
                  end: at,
                  text: ' data-agata-id="' + uuid() + '"',
                });
              }
            }
            if (a) seen.add(a.value);
          }
          for (const c of node.childNodes || []) visit(c, depth + 1);
        };
        visit(ast);
        let content = e.content;
        for (const p of patches.sort((a, b) => b.start - a.start))
          content = content.slice(0, p.start) + p.text + content.slice(p.end);
        if (content !== e.content)
          changes.push({ file, before: e.content, after: content });
      }
      if (changes.length)
        this.command("Identificar elementos importados", changes);
    }
    transaction(description, fn) {
      if (this.transactionState) return fn();
      const metadataBefore = this.metadata;
      const before = new Map(),
        past = this.history.past.slice(),
        future = this.history.future.slice();
      this.transactionState = before;
      try {
        fn();
        const metadataAfter = this.metadata;
        const changes = [...before].map(([file, value]) => ({
          file,
          before: value?.content ?? null,
          beforeEncoding: value?.encoding,
          after: this.files.get(file)?.content ?? null,
          afterEncoding: this.files.get(file)?.encoding,
        }));
        for (const [file, value] of before) {
          if (value === null) this.files.delete(file);
          else
            this.files.set(file, {
              ...this.files.get(file),
              path: file,
              encoding: value.encoding,
              content: value.content,
            });
        }
        this.history.past = past;
        this.history.future = future;
        this.transactionState = null;
        this.metadata = metadataBefore;
        this.command(
          description,
          changes,
          metadataBefore !== metadataAfter
            ? { before: metadataBefore, after: metadataAfter }
            : null,
        );
      } catch (error) {
        for (const [file, value] of before) {
          if (value === null) this.files.delete(file);
          else
            this.files.set(file, {
              ...this.files.get(file),
              path: file,
              encoding: value.encoding,
              content: value.content,
            });
        }
        this.history.past = past;
        this.history.future = future;
        this.transactionState = null;
        this.metadata = metadataBefore;
        this.index();
        throw error;
      }
    }
    command(description, changes, metadata = null) {
      if (this.transactionState)
        for (const c of changes)
          if (!this.transactionState.has(c.file))
            this.transactionState.set(
              c.file,
              c.before === null
                ? null
                : {
                    content: c.before,
                    encoding:
                      c.beforeEncoding ||
                      this.files.get(c.file)?.encoding ||
                      "utf8",
                  },
            );
      const entries = changes
        .filter((c) => c.before !== c.after)
        .map((c) => ({
          file: path(c.file),
          beforeExists: c.before !== null,
          afterExists: c.after !== null,
          beforeEncoding:
            c.beforeEncoding || this.files.get(c.file)?.encoding || "utf8",
          afterEncoding:
            c.afterEncoding || this.files.get(c.file)?.encoding || "utf8",
          ...diff(c.before || "", c.after || ""),
        }));
      if (entries.length || metadata)
        this.history.execute({ description, entries, metadata });
    }
    apply(command, reverse) {
      const prepared = [];
      for (const p of command.entries) {
        const exists = reverse ? p.beforeExists : p.afterExists;
        const remove = reverse ? p.inserted : p.removed,
          insert = reverse ? p.removed : p.inserted;
        const previous = this.files.get(p.file);
        const text = previous?.content || "";
        if (text.slice(p.start, p.start + remove.length) !== remove)
          throw Error("Conflito de buffer: " + p.file);
        prepared.push({
          file: p.file,
          exists,
          previous,
          encoding: reverse ? p.beforeEncoding : p.afterEncoding,
          content:
            text.slice(0, p.start) +
            insert +
            text.slice(p.start + remove.length),
        });
      }
      for (const p of prepared) {
        if (p.exists)
          this.files.set(p.file, {
            ...p.previous,
            path: p.file,
            encoding: p.encoding,
            content: p.content,
            version: (p.previous?.version || 0) + 1,
          });
        else this.files.delete(p.file);
      }
      if (command.metadata)
        this.metadata = structuredClone(
          command.metadata[reverse ? "before" : "after"],
        );
      this.index();
      this.emit(command);
    }
    edit(file, content, description = "Editar código") {
      this.command(description, [
        {
          file,
          before: this.files.has(file) ? this.text(file) : null,
          after: content,
        },
      ]);
    }
    editMetadata(description, mutator) {
      const before = structuredClone(this.metadata),
        after = structuredClone(before);
      mutator(after);
      if (JSON.stringify(before) !== JSON.stringify(after))
        this.history.execute({
          description,
          entries: [],
          metadata: { before, after },
        });
    }
    get dirty() {
      const p = this.payload();
      return (
        Object.keys(p.files).length > 0 ||
        p.deleted.length > 0 ||
        JSON.stringify(this.metadata) !== this.metadataBaseline
      );
    }
    removeFile(file) {
      const e = this.files.get(file);
      if (!e) throw Error("Arquivo inexistente");
      this.command("Excluir arquivo", [
        { file, before: e.content, after: null, beforeEncoding: e.encoding },
      ]);
    }
    renameFile(from, to) {
      path(to);
      if (this.files.has(to)) throw Error("Destino já existe");
      const e = this.files.get(from);
      if (!e) throw Error("Arquivo inexistente");
      this.command("Mover arquivo", [
        {
          file: from,
          before: e.content,
          after: null,
          beforeEncoding: e.encoding,
        },
        { file: to, before: null, after: e.content, afterEncoding: e.encoding },
      ]);
    }
    rename(from, to) {
      if (from === this.metadata.entry && !/\.html?$/i.test(to))
        throw Error("A página inicial deve continuar sendo HTML");
      this.transaction("Mover arquivo", () => {
        this.renameFile(from, to);
        this.editMetadata("Atualizar caminhos", (m) => {
          if (m.entry === from) m.entry = to;
          for (const c of Object.values(m.components || {}))
            if (c.path === from) c.path = to;
        });
        this.references?.rewrite(this, new Map([[from, to]]));
      });
    }
    renamePath(from, to) {
      path(from);
      path(to);
      if (this.files.has(from)) {
        this.rename(from, to);
        return;
      }
      if (to.startsWith(from + "/"))
        throw Error("Não mova uma pasta para dentro dela mesma");
      const files = [...this.files.keys()].filter((p) =>
        p.startsWith(from + "/"),
      );
      if (!files.length && !(this.metadata.folders || []).includes(from))
        throw Error("Pasta inexistente");
      this.transaction("Mover pasta", () => {
        for (const file of files)
          this.renameFile(file, to + file.slice(from.length));
        this.references?.rewrite(
          this,
          new Map(files.map((file) => [file, to + file.slice(from.length)])),
        );
        this.editMetadata("Mover pasta", (m) => {
          if (m.entry.startsWith(from + "/"))
            m.entry = to + m.entry.slice(from.length);
          for (const c of Object.values(m.components || {}))
            if (c.path?.startsWith(from + "/"))
              c.path = to + c.path.slice(from.length);
          m.folders = [
            ...new Set([
              ...(m.folders || []).map((p) =>
                p === from || p.startsWith(from + "/")
                  ? to + p.slice(from.length)
                  : p,
              ),
              to,
            ]),
          ];
        });
      });
    }
    removePath(name) {
      if (
        this.metadata.entry === name ||
        this.metadata.entry.startsWith(name + "/")
      )
        throw Error(
          "Defina outra página inicial antes de excluir este caminho",
        );
      if (this.files.has(name)) {
        this.removeFile(name);
        return;
      }
      const files = [...this.files.keys()].filter((p) =>
        p.startsWith(name + "/"),
      );
      this.transaction("Excluir pasta", () => {
        for (const file of files) this.removeFile(file);
        this.editMetadata("Excluir pasta", (m) => {
          m.folders = (m.folders || []).filter(
            (p) => p !== name && !p.startsWith(name + "/"),
          );
        });
      });
    }
    duplicateFile(from, to) {
      path(to);
      if (this.files.has(to)) throw Error("Arquivo já existe");
      const entry = this.files.get(from);
      if (!entry) throw Error("Selecione um arquivo");
      this.command("Duplicar arquivo", [
        {
          file: to,
          before: null,
          after: entry.content,
          afterEncoding: entry.encoding,
        },
      ]);
    }
    node(id) {
      const n = this.nodes.get(id);
      if (!n) throw Error("Selecione um elemento mapeado");
      return n;
    }
    attribute(id, name, value) {
      if (
        !/^[a-zA-Z_:][\w:.-]*$/.test(name) ||
        name === "data-agata-id" ||
        /^on/i.test(name)
      )
        throw Error("Atributo não suportado");
      const n = this.node(id),
        src = this.text(n.file);
      let tag = src.slice(n.startTag.startOffset, n.startTag.endOffset);
      const a = n.location.attrs?.[name];
      if (a) {
        const left = a.startOffset - n.startTag.startOffset,
          right = a.endOffset - n.startTag.startOffset;
        tag =
          tag.slice(0, left) +
          (value === null ? "" : name + '="' + escape(value) + '"') +
          tag.slice(right);
      } else if (value !== null) {
        const at = tag.endsWith("/>") ? tag.length - 2 : tag.length - 1;
        tag =
          tag.slice(0, at) +
          " " +
          name +
          '="' +
          escape(value) +
          '"' +
          tag.slice(at);
      }
      this.edit(
        n.file,
        src.slice(0, n.startTag.startOffset) +
          tag +
          src.slice(n.startTag.endOffset),
        "Alterar " + name,
      );
    }
    canContain(parent, tag) {
      if (
        voids.has(parent) ||
        ["script", "style", "textarea", "title"].includes(parent)
      )
        return false;
      if (["ul", "ol"].includes(parent)) return tag === "li";
      if (parent === "select") return ["option", "optgroup"].includes(tag);
      if (parent === "optgroup") return tag === "option";
      if (parent === "table")
        return ["caption", "colgroup", "thead", "tbody", "tfoot"].includes(tag);
      if (["thead", "tbody", "tfoot"].includes(parent)) return tag === "tr";
      if (parent === "tr") return ["th", "td"].includes(tag);
      if (parent === "dl") return ["dt", "dd"].includes(tag);
      if (
        [
          "p",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "span",
          "strong",
          "em",
          "small",
          "mark",
          "code",
          "button",
          "label",
        ].includes(parent)
      )
        return [
          "span",
          "strong",
          "em",
          "small",
          "mark",
          "code",
          "a",
          "img",
          "br",
        ].includes(tag);
      return ![
        "li",
        "tr",
        "td",
        "th",
        "option",
        "optgroup",
        "thead",
        "tbody",
        "tfoot",
        "html",
        "head",
        "body",
      ].includes(tag);
    }
    identify(html) {
      const ast = this.parsers.html.parseFragment(html, {
          sourceCodeLocationInfo: true,
        }),
        patches = [];
      const visit = (n) => {
        if (n.tagName && n.sourceCodeLocation?.startTag) {
          const loc = n.sourceCodeLocation;
          const a = loc.attrs?.["data-agata-id"];
          if (a)
            patches.push({
              start: a.startOffset,
              end: a.endOffset,
              text: 'data-agata-id="' + uuid() + '"',
            });
          else {
            const at =
              loc.startTag.endOffset -
              (html[loc.startTag.endOffset - 2] === "/" ? 2 : 1);
            patches.push({
              start: at,
              end: at,
              text: ' data-agata-id="' + uuid() + '"',
            });
          }
        }
        for (const c of n.childNodes || []) visit(c);
      };
      visit(ast);
      for (const p of patches.sort((a, b) => b.start - a.start))
        html = html.slice(0, p.start) + p.text + html.slice(p.end);
      return html;
    }
    insert(file, parentId, html, beforeId = null) {
      const parent = parentId ? this.node(parentId) : null;
      let offset;
      const fragment = this.parsers.html.parseFragment(html);
      for (const child of fragment.childNodes.filter((n) => n.tagName))
        if (!this.canContain(parent?.tag || "body", child.tagName))
          throw Error("Estrutura HTML inválida para este container");
      if (parent) {
        file = parent.file;
        if (!parent.endTag) throw Error("Container sem fechamento explícito");
        offset = parent.endTag.startOffset;
      } else {
        const ast = this.parsers.html.parse(this.text(file), {
          sourceCodeLocationInfo: true,
        });
        const body = ast.childNodes
          .find((n) => n.tagName === "html")
          ?.childNodes.find((n) => n.tagName === "body");
        offset =
          body?.sourceCodeLocation?.endTag?.startOffset ??
          this.text(file).length;
      }
      if (beforeId) {
        const sibling = this.node(beforeId);
        if (sibling.file !== file || sibling.parent?.id !== parentId)
          throw Error("Destino inválido");
        offset = sibling.start;
      }
      const src = this.text(file);
      this.edit(
        file,
        src.slice(0, offset) +
          "\n" +
          this.identify(html) +
          "\n" +
          src.slice(offset),
        "Inserir componente",
      );
    }
    remove(id) {
      const n = this.node(id),
        src = this.text(n.file);
      this.edit(
        n.file,
        src.slice(0, n.start) + src.slice(n.end),
        "Excluir elemento",
      );
    }
    topNodes(ids) {
      const unique = [...new Set(ids)].map((id) => this.node(id));
      return unique
        .filter((n) => {
          for (let p = n.parent; p; p = p.parent)
            if (unique.includes(p)) return false;
          return true;
        })
        .sort((a, b) => a.file.localeCompare(b.file) || a.start - b.start);
    }
    group(ids) {
      const nodes = this.topNodes(ids);
      if (!nodes.length) throw Error("Selecione elementos");
      const first = nodes[0],
        parent = first.parent;
      if (
        nodes.some((n) => n.file !== first.file || n.parent !== parent) ||
        !this.canContain(parent?.tag || "body", "div")
      )
        throw Error("Agrupamento requer irmãos em um container válido");
      const src = this.text(first.file),
        html = nodes.map((n) => src.slice(n.start, n.end)).join("\n");
      let after = src;
      for (const n of [...nodes].reverse())
        after = after.slice(0, n.start) + after.slice(n.end);
      after =
        after.slice(0, first.start) +
        '<div data-agata-id="' +
        uuid() +
        '">' +
        html +
        "</div>" +
        after.slice(first.start);
      this.edit(first.file, after, "Agrupar elementos");
    }
    duplicate(id) {
      const n = this.node(id);
      this.insert(
        n.file,
        n.parent?.id || null,
        this.text(n.file).slice(n.start, n.end),
        null,
      );
    }
    move(id, parentId, beforeId = null) {
      const n = this.node(id),
        p = parentId ? this.node(parentId) : null;
      if (p && p.file !== n.file)
        throw Error("Mover entre arquivos requer copiar/colar");
      for (let x = p; x; x = x.parent)
        if (x.id === id) throw Error("Um elemento não pode conter a si mesmo");
      if (!this.canContain(p?.tag || "body", n.tag))
        throw Error("Destino HTML inválido");
      if (beforeId === id) return;
      const src = this.text(n.file);
      let at = beforeId ? this.node(beforeId).start : p?.endTag?.startOffset;
      if (at === undefined) {
        const ast = this.parsers.html.parse(src, {
          sourceCodeLocationInfo: true,
        });
        at =
          ast.childNodes
            .find((x) => x.tagName === "html")
            ?.childNodes.find((x) => x.tagName === "body")?.sourceCodeLocation
            ?.endTag?.startOffset ?? src.length;
      }
      if (at >= n.start && at <= n.end) return;
      const html = src.slice(n.start, n.end),
        without = src.slice(0, n.start) + src.slice(n.end);
      if (at > n.end) at -= n.end - n.start;
      this.edit(
        n.file,
        without.slice(0, at) + html + without.slice(at),
        "Mover elemento",
      );
    }
    resource(file, marker, html) {
      const source = this.text(file),
        ast = this.parsers.html.parse(source, { sourceCodeLocationInfo: true });
      let found = false,
        head = null,
        root = null;
      const visit = (n) => {
        if (n.attrs?.some((a) => a.name === marker)) found = true;
        if (n.tagName === "head") head = n;
        if (n.tagName === "html") root = n;
        for (const c of n.childNodes || []) visit(c);
      };
      visit(ast);
      if (found) return;
      let offset = head?.sourceCodeLocation?.endTag?.startOffset,
        addition = html;
      if (offset === undefined) {
        offset = root?.sourceCodeLocation?.startTag?.endOffset;
        if (offset === undefined) return;
        addition = "<head>" + html + "</head>";
      }
      this.edit(
        file,
        source.slice(0, offset) + addition + "\n" + source.slice(offset),
        "Vincular recurso",
      );
    }
    editRule(rule, value) {
      const entry = this.files.get(rule.file);
      if (
        !entry ||
        entry.version !== rule.fileVersion ||
        !Number.isInteger(rule.start) ||
        !Number.isInteger(rule.end)
      )
        throw Error("Regra alterada: selecione a propriedade novamente");
      const source = rule.property + ": " + value,
        ast = this.parsers.css.parse(source, { context: "declarationList" });
      if (
        ast.children.size !== 1 ||
        ast.children.first.type !== "Declaration" ||
        ast.children.first.property !== rule.property
      )
        throw Error("Declaração CSS inválida");
      this.edit(
        rule.file,
        entry.content.slice(0, rule.start) +
          source +
          entry.content.slice(rule.end),
        "Editar regra de origem",
      );
    }
    style(id, property, value, media = "", state = "", instance = null) {
      if (
        !["", "hover", "focus", "active", "disabled", "checked"].includes(state)
      )
        throw Error("Estado CSS inválido");
      if (!/^(--[\w-]+|[a-z][a-z-]*)$/.test(property))
        throw Error("Propriedade CSS inválida");
      const ast = this.parsers.css.parse("x{" + property + ":" + value + "}", {
        positions: true,
      });
      if (
        ast.children.size !== 1 ||
        ast.children.first?.block?.children.size !== 1 ||
        ast.children.first.block.children.first?.property !== property
      )
        throw Error("Uma declaração CSS é necessária");
      const file = "css/overrides.css",
        before = this.files.has(file) ? this.text(file) : null;
      const prefix = instance
        ? this.node(instance).tag === "agata-include"
          ? '[data-agata-id="' + instance + '"] '
          : ""
        : "";
      const selector =
        prefix +
        '[data-agata-id="' +
        this.node(id).id +
        '"]' +
        (state ? ":" + state : "");
      const rule = selector + " { " + property + ": " + value + "; }";
      const addition = media
        ? (media.startsWith("@container ") ? media : "@media " + media) +
          " { " +
          rule +
          " }"
        : rule;
      this.parsers.css.parse(addition);
      this.transaction("Estilo " + property, () => {
        this.edit(
          file,
          (before ||
            "/* Agata instance overrides. Original stylesheets are preserved. */\n") +
            "\n" +
            addition +
            "\n",
          "Criar override CSS",
        );
        for (const [p, e] of this.files)
          if (
            /\.html?$/i.test(p) &&
            e.encoding === "utf8" &&
            !p.startsWith("components/")
          ) {
            const prefix = "../".repeat(p.split("/").length - 1);
            this.resource(
              p,
              "data-agata-overrides",
              '<link data-agata-overrides rel="stylesheet" href="' +
                prefix +
                file +
                '">',
            );
          }
      });
    }
    payload() {
      const files = {},
        deleted = [];
      for (const [p, e] of this.files)
        if (
          !this.baseline.has(p) ||
          e.content !== this.baselineContent.get(p)?.content ||
          e.encoding !== this.baselineContent.get(p)?.encoding
        )
          files[p] = { ...e, expected_sha256: this.baseline.get(p) || null };
      for (const p of this.baseline.keys())
        if (!this.files.has(p)) deleted.push(p);
      return {
        files,
        deleted,
        expected_deleted: Object.fromEntries(
          deleted.map((p) => [p, this.baseline.get(p)]),
        ),
        metadata: this.metadata,
        revision: this.revision,
      };
    }
    saved(result) {
      this.revision = result.revision;
      for (const p of [...this.baseline.keys()])
        if (!this.files.has(p)) this.baseline.delete(p);
      for (const [p, hash] of Object.entries(result.files)) {
        this.baseline.set(p, hash);
        const e = this.files.get(p);
        if (e) {
          this.baselineContent.set(p, {
            content: e.content,
            encoding: e.encoding,
          });
          e.sha256 = hash;
        }
      }
    }
  }
  global.AgataWebDomain = {
    WebDocument,
    History,
    diff,
    path,
    escape,
    voids,
    nonvisual,
  };
})(typeof window === "undefined" ? globalThis : window);
