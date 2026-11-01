/* Layout policy takes facts from adapters and produces ordinary CSS commands. */
(function (global) {
  "use strict";
  class LayoutService {
    constructor(doc, facts) {
      this.doc = doc;
      this.facts = facts;
    }
    center(id, axis = "both") {
      const n = this.doc.node(id),
        self = this.facts(id),
        parent = n.parent?.id ? this.facts(n.parent.id) : null;
      this.doc.transaction("Centralizar " + axis, () => {
        if (self?.position === "absolute") {
          if (axis !== "vertical") this.doc.style(id, "left", "50%");
          if (axis !== "horizontal") this.doc.style(id, "top", "50%");
          const translate =
            axis === "both"
              ? "translate(-50%,-50%)"
              : axis === "horizontal"
                ? "translateX(-50%)"
                : "translateY(-50%)";
          this.doc.style(
            id,
            "transform",
            translate +
              (self.transform && self.transform !== "none"
                ? " " + self.transform
                : ""),
          );
        } else if (parent?.display.includes("flex")) {
          const row = !parent.flexDirection.startsWith("column");
          if (axis === "both" || (axis === "horizontal") === row)
            this.doc.style(n.parent.id, "justify-content", "center");
          if (axis === "both" || (axis === "horizontal") !== row)
            this.doc.style(n.parent.id, "align-items", "center");
        } else if (parent?.display.includes("grid")) {
          if (axis !== "vertical") this.doc.style(id, "justify-self", "center");
          if (axis !== "horizontal") this.doc.style(id, "align-self", "center");
        } else if (n.parent?.id) {
          this.doc.style(n.parent.id, "display", "grid");
          if (axis !== "vertical") this.doc.style(id, "justify-self", "center");
          if (axis !== "horizontal") this.doc.style(id, "align-self", "center");
        } else {
          if (axis === "vertical")
            throw Error("Centralização vertical requer um container mapeado");
          this.doc.style(id, "margin-inline", "auto");
          this.doc.style(id, "display", "block");
        }
      });
    }
    distribute(id) {
      const n = this.doc.node(id),
        style = this.facts(id);
      if (!n.children.length) throw Error("Selecione um container com filhos");
      this.doc.transaction("Distribuir filhos", () => {
        if (style?.display.includes("flex"))
          this.doc.style(id, "justify-content", "space-between");
        else if (style?.display.includes("grid"))
          this.doc.style(id, "justify-content", "space-evenly");
        else {
          this.doc.style(id, "display", "flex");
          this.doc.style(id, "justify-content", "space-between");
        }
      });
    }
    autoLayout(id, mode = "flex") {
      const n = this.doc.node(id);
      if (!n.children.length) throw Error("Selecione um container");
      this.doc.transaction("Auto layout " + mode, () => {
        this.doc.style(id, "display", mode);
        this.doc.style(id, "gap", "16px");
        if (mode === "grid")
          this.doc.style(
            id,
            "grid-template-columns",
            "repeat(auto-fit,minmax(min(100%,240px),1fr))",
          );
        else this.doc.style(id, "flex-wrap", "wrap");
      });
    }
  }
  global.AgataWebLayout = { LayoutService };
})(window);
