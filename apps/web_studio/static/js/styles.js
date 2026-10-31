/* Browser computes cascade; the AST adapter supplies authored rule provenance. */
(function (global) {
  "use strict";
  function specificity(selector, css) {
    let score = [0, 0, 0];
    try {
      const ast = css.parse(selector, { context: "selector" });
      css.walk(ast, (n) => {
        if (n.type === "IdSelector") score[0]++;
        if (
          [
            "ClassSelector",
            "AttributeSelector",
            "PseudoClassSelector",
          ].includes(n.type) &&
          n.name !== "where"
        )
          score[1]++;
        if (
          ["TypeSelector", "PseudoElementSelector"].includes(n.type) &&
          n.name !== "*"
        )
          score[2]++;
      });
    } catch {}
    return score;
  }
  class StyleResolver {
    constructor(doc, canvas) {
      this.doc = doc;
      this.canvas = canvas;
    }
    resolve(id, property, instance = null) {
      const element = this.canvas.editor.Canvas.getDocument()?.querySelector(
        (instance ? '[data-agata-id="' + instance + '"] ' : "") +
          '[data-agata-id="' +
          id +
          '"]',
      );
      if (!element) return { value: "", rules: [] };
      const computed =
          element.ownerDocument.defaultView.getComputedStyle(element),
        css = global.AgataWebParsers.css,
        rules = [];
      let order = 0;
      for (const [file, entry] of this.doc.files) {
        if (
          entry.encoding !== "utf8" ||
          !/\.css$/i.test(file) ||
          (this.canvas.activeStylesheets &&
            !this.canvas.activeStylesheets.has(file))
        )
          continue;
        try {
          const tree = css.parse(entry.content, { positions: true });
          const conditions = [];
          css.walk(tree, {
            enter(node) {
              if (node.type === "Atrule")
                conditions.push({
                  name: node.name,
                  value: node.prelude ? css.generate(node.prelude) : "",
                });
              if (node.type !== "Rule") return;
              const selector = css.generate(node.prelude);
              let matches = false;
              try {
                matches = element.matches(selector);
              } catch {}
              if (!matches) return;
              for (const declaration of node.block.children) {
                if (
                  declaration.type !== "Declaration" ||
                  (declaration.property !== property &&
                    !declaration.property.startsWith("--"))
                )
                  continue;
                const value = css.generate(declaration.value);
                rules.push({
                  file,
                  fileVersion: entry.version,
                  selector,
                  property: declaration.property,
                  value,
                  important: !!declaration.important,
                  specificity: specificity(selector, css),
                  line: declaration.loc?.start.line,
                  start: declaration.loc?.start.offset,
                  end: declaration.loc?.end.offset,
                  order: order++,
                  conditions: conditions.slice(),
                  active: conditions.every(
                    (c) =>
                      c.name !== "media" ||
                      element.ownerDocument.defaultView.matchMedia(c.value)
                        .matches,
                  ),
                });
              }
            },
            leave(node) {
              if (node.type === "Atrule") conditions.pop();
            },
          });
        } catch (error) {
          this.doc.diagnostics.push({ file, message: error.message });
        }
      }
      const inline = element.style.getPropertyValue(property);
      if (inline)
        rules.push({
          file: this.doc.node(id).file,
          selector: "style attribute",
          property,
          value: inline,
          important:
            element.style.getPropertyPriority(property) === "important",
          specificity: [1, 0, 0, 0],
          active: true,
        });
      return {
        value: computed.getPropertyValue(property),
        rules: rules.filter((r) => r.property === property),
        variables: rules.filter((r) => r.property.startsWith("--")),
      };
    }
  }
  global.AgataWebStyles = { StyleResolver };
})(window);
