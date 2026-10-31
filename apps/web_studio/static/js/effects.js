/* Editors produce CSS values/rules. They never rasterize gradients or execute project JS. */
(function (global) {
  "use strict";
  class GradientEditor {
    constructor(root, apply) {
      this.root = root;
      this.apply = apply;
      this.q = (name) => root.querySelector("#ws-gradient-" + name);
      this.stops = [
        { color: "#16152b", position: 0, alpha: 1 },
        { color: "#4741a8", position: 55, alpha: 1 },
        { color: "#a051c8", position: 100, alpha: 1 },
      ];
      this.host = document.createElement("div");
      this.preview = document.createElement("div");
      this.preview.style.cssText = "height:52px;border-radius:8px;margin:8px 0";
      this.list = document.createElement("div");
      const add = document.createElement("button");
      add.textContent = "+ Color stop";
      add.type = "button";
      add.onclick = () => {
        this.stops.push({ color: "#ffffff", position: 100, alpha: 1 });
        this.render();
        this.sync();
      };
      const copy = document.createElement("button");
      copy.textContent = "Copiar CSS";
      copy.type = "button";
      copy.onclick = () =>
        navigator.clipboard
          .writeText("background: " + this.value() + ";")
          .catch(() => {});
      this.host.append(this.preview, this.list, add, copy);
      this.q("stops").parentElement.after(this.host);
      this.q("stops").addEventListener("change", () =>
        this.import(this.value()),
      );
      for (const n of ["kind", "angle"])
        this.q(n).addEventListener(
          "input",
          () => (this.preview.style.background = this.value()),
        );
      this.render();
      this.sync();
    }
    value() {
      const kind = this.q("kind").value,
        angle = Number(this.q("angle").value);
      return (
        kind +
        "-gradient(" +
        (kind === "linear"
          ? angle + "deg, "
          : kind === "conic"
            ? "from " + angle + "deg, "
            : "circle, ") +
        this.q("stops").value +
        ")"
      );
    }
    sync() {
      this.stops.sort((a, b) => a.position - b.position);
      this.q("stops").value = this.stops
        .map(
          (s) =>
            s.color +
            (s.alpha < 1
              ? Math.round(s.alpha * 255)
                  .toString(16)
                  .padStart(2, "0")
              : "") +
            " " +
            s.position +
            "%",
        )
        .join(", ");
      this.preview.style.background = this.value();
    }
    render() {
      this.list.replaceChildren();
      for (const [index, stop] of this.stops.entries()) {
        const row = document.createElement("div");
        row.style.cssText =
          "display:flex;gap:4px;margin:4px 0;align-items:center";
        const color = document.createElement("input");
        color.type = "color";
        color.value = stop.color;
        color.setAttribute("aria-label", "Cor do stop " + (index + 1));
        color.style.width = "40px";
        color.oninput = () => {
          stop.color = color.value;
          this.sync();
        };
        const position = document.createElement("input");
        position.type = "number";
        position.min = "0";
        position.max = "100";
        position.value = stop.position;
        position.setAttribute(
          "aria-label",
          "Posição percentual " + (index + 1),
        );
        position.style.width = "64px";
        position.onchange = () => {
          stop.position = Math.max(0, Math.min(100, Number(position.value)));
          this.sync();
        };
        const alpha = document.createElement("input");
        alpha.type = "range";
        alpha.min = "0";
        alpha.max = "1";
        alpha.step = ".01";
        alpha.value = stop.alpha;
        alpha.setAttribute("aria-label", "Alpha " + (index + 1));
        alpha.style.width = "70px";
        alpha.oninput = () => {
          stop.alpha = Number(alpha.value);
          this.sync();
        };
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Excluir stop " + (index + 1));
        remove.onclick = () => {
          if (this.stops.length > 2) {
            this.stops.splice(index, 1);
            this.render();
            this.sync();
          }
        };
        row.append(color, position, alpha, remove);
        this.list.append(row);
      }
    }
    import(value) {
      try {
        const css = global.AgataWebParsers.css,
          ast = css.parse(value, { context: "value" }),
          fn = ast.children.first;
        if (
          fn?.type !== "Function" ||
          !["linear-gradient", "radial-gradient", "conic-gradient"].includes(
            fn.name,
          )
        )
          return false;
        this.q("kind").value = fn.name.split("-")[0];
        const groups = [[]];
        for (const node of fn.children) {
          if (node.type === "Operator" && node.value === ",") groups.push([]);
          else groups.at(-1).push(node);
        }
        const stops = [];
        for (const nodes of groups) {
          const first = nodes[0];
          if (!first) continue;
          const color = css.generate(first);
          if (!CSS.supports("color", color)) {
            const raw = nodes.map((n) => css.generate(n)).join(" "),
              angle = raw.match(/(-?[\d.]+)deg/);
            if (angle) this.q("angle").value = angle[1];
            continue;
          }
          const c = document.createElement("canvas");
          c.width = c.height = 1;
          const ctx = c.getContext("2d");
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const pixel = ctx.getImageData(0, 0, 1, 1).data,
            hex =
              "#" +
              [...pixel]
                .slice(0, 3)
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("");
          stops.push({
            color: hex,
            alpha: pixel[3] / 255,
            position:
              nodes[1]?.type === "Percentage" ? Number(nodes[1].value) : NaN,
          });
        }
        if (stops.length < 2) return false;
        stops.forEach((s, i) => {
          if (Number.isNaN(s.position))
            s.position = (i / (stops.length - 1)) * 100;
        });
        this.stops = stops;
        this.render();
        this.sync();
        return true;
      } catch {
        return false;
      }
    }
  }
  class AnimationTimeline {
    constructor(root) {
      const q = (id) => root.querySelector("#ws-" + id),
        host = document.createElement("div");
      this.host = host;
      const position = document.createElement("input");
      position.type = "range";
      position.min = "0";
      position.max = "100";
      position.value = "50";
      position.setAttribute("aria-label", "Posição do keyframe");
      const label = document.createElement("output");
      label.textContent = "50%";
      position.oninput = () => (label.textContent = position.value + "%");
      const property = document.createElement("select");
      for (const p of ["opacity", "transform", "left", "top"])
        property.add(new Option(p, p));
      property.setAttribute("aria-label", "Propriedade animada");
      const value = document.createElement("input");
      value.value = "translateY(-12px)";
      value.setAttribute("aria-label", "Valor do keyframe");
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "Salvar keyframe";
      add.onclick = () => {
        if (!CSS.supports(property.value, value.value)) return;
        const css = global.AgataWebParsers.css,
          source = q("animation-frames").value;
        css.parse("@keyframes x{" + source + "}");
        q("animation-frames").value =
          source +
          "\n" +
          position.value +
          "% { " +
          property.value +
          ": " +
          value.value +
          "; }";
      };
      host.append(position, label, property, value, add);
      q("animation-frames").parentElement.after(host);
    }
  }
  global.AgataWebEffects = { GradientEditor, AnimationTimeline };
})(window);
