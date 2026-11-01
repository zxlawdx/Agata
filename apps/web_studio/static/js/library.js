/* Original high-level blocks bring isolated, editable assets to imported projects. */
(function (global) {
  "use strict";
  function scopedCss(source) {
    const css = global.AgataWebParsers.css,
      ast = css.parse(source);
    const keyframeRules = new WeakSet();
    css.walk(ast, (node) => {
      if (
        node.type === "Atrule" &&
        node.name.endsWith("keyframes") &&
        node.block
      )
        css.walk(node.block, (child) => {
          if (child.type === "Rule") keyframeRules.add(child);
        });
    });
    css.walk(ast, (node) => {
      if (
        node.type !== "Rule" ||
        node.prelude?.type !== "SelectorList" ||
        keyframeRules.has(node)
      )
        return;
      const selectors = [];
      for (const selector of node.prelude.children) {
        const text = css.generate(selector);
        selectors.push(
          [":root", "html", "body"].includes(text)
            ? ".agata-components"
            : ".agata-components " + text,
        );
      }
      node.prelude = css.parse(selectors.join(","), {
        context: "selectorList",
      });
    });
    return css.generate(ast);
  }
  function insert(
    doc,
    definition,
    parent,
    before,
    resources,
    file = doc.metadata.entry,
  ) {
    doc.transaction("Inserir " + definition.name, () => {
      let html = definition.html;
      if (!doc.metadata.template) {
        let namespace = doc.metadata.libraryAssets?.namespace;
        if (!namespace) {
          let index = 1;
          namespace = "agata-library-v1";
          while (
            [...doc.files.keys()].some((p) => p.startsWith(namespace + "/"))
          )
            namespace = "agata-library-v1-" + ++index;
          doc.editMetadata(
            "Registrar assets da biblioteca",
            (m) => (m.libraryAssets = { version: 1, namespace }),
          );
          const runtime =
            resources.js.replace(
              "root.querySelectorAll('article.card,tbody tr')",
              "(root.closest('main')||document).querySelectorAll('article.card,tbody tr')",
            ) +
            "\nfor(const root of document.querySelectorAll('[data-agata-library]'))mountInteractions(root);\n";
          doc.edit(
            namespace + "/components.css",
            scopedCss(resources.css),
            "Adicionar CSS modular",
          );
          doc.edit(
            namespace + "/interactions.js",
            runtime,
            "Adicionar módulo de interações",
          );
        }
        html =
          '<div class="agata-components" data-agata-library="' +
          definition.id +
          '">' +
          html +
          "</div>";
        for (const [file, entry] of doc.files) {
          if (
            entry.encoding !== "utf8" ||
            !/\.html?$/i.test(file) ||
            file.startsWith("components/")
          )
            continue;
          const prefix = "../".repeat(file.split("/").length - 1);
          doc.resource(
            file,
            "data-agata-library-css",
            '<link data-agata-library-css rel="stylesheet" href="' +
              prefix +
              namespace +
              '/components.css">',
          );
          doc.resource(
            file,
            "data-agata-library-js",
            '<script data-agata-library-js type="module" src="' +
              prefix +
              namespace +
              '/interactions.js"></script>',
          );
        }
      }
      doc.insert(file, parent, html, before);
    });
  }
  global.AgataWebLibrary = { insert, scopedCss };
})(window);
