/* Metadata-driven CSS Inspector is a DOM adapter, independent of Monaco and storage. */
(function (global) {
  "use strict";
  const GROUPS = {
    Layout: [
      "display",
      "position",
      "width",
      "height",
      "min-width",
      "max-width",
      "min-height",
      "max-height",
      "overflow",
      "visibility",
      "aspect-ratio",
    ],
    Flexbox: [
      "flex-direction",
      "flex-wrap",
      "justify-content",
      "align-items",
      "align-content",
      "gap",
      "flex-grow",
      "flex-shrink",
      "flex-basis",
      "order",
      "align-self",
    ],
    Grid: [
      "grid-template-columns",
      "grid-template-rows",
      "grid-column",
      "grid-row",
      "grid-area",
      "justify-items",
      "align-items",
      "justify-self",
      "align-self",
    ],
    Spacing: [
      "margin",
      "padding",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
    ],
    Typography: [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "letter-spacing",
      "color",
      "text-align",
      "text-decoration",
    ],
    Background: [
      "background",
      "background-color",
      "background-image",
      "background-position",
      "background-size",
      "background-repeat",
    ],
    Borders: [
      "border",
      "border-width",
      "border-style",
      "border-color",
      "border-radius",
    ],
    Effects: [
      "box-shadow",
      "filter",
      "backdrop-filter",
      "opacity",
      "mix-blend-mode",
    ],
    Transforms: ["transform", "transform-origin"],
    Animation: [
      "transition",
      "animation",
      "animation-duration",
      "animation-delay",
      "animation-direction",
      "animation-fill-mode",
      "animation-iteration-count",
    ],
  };
  function create({
    q,
    on,
    getDocument,
    getCanvas,
    getSelected,
    getInstance,
    getSelection,
    gradientEditor,
    fail,
  }) {
    function renderInspector() {
      const doc = getDocument(),
        canvas = getCanvas(),
        selected = getSelected();
      const node = doc.nodes.get(selected);
      q("selection").textContent = node
        ? "<" +
          node.tag +
          "> · " +
          node.file +
          (getInstance()
            ? " · instância " + getInstance()
            : node.file.startsWith("components/")
              ? " · definição compartilhada"
              : "")
        : "Selecione um elemento";
      q("attributes").replaceChildren();
      if (!node) return;
      for (const attr of [
        "id",
        "class",
        "title",
        "aria-label",
        "role",
        "alt",
        "href",
        "src",
        "type",
        "placeholder",
        "tabindex",
      ]) {
        const label = document.createElement("label");
        label.textContent = attr;
        const input = document.createElement("input");
        input.value = node.attributes[attr] || "";
        on(input, "change", () => {
          try {
            doc.attribute(selected, attr, input.value || null);
          } catch (e) {
            fail(e);
          }
        });
        label.append(input);
        q("attributes").append(label);
      }
      const computed = canvas.computed(selected, getInstance());
      gradientEditor.import(computed?.backgroundImage || "");
      q("computed").textContent =
        [
          "display",
          "width",
          "height",
          "color",
          "background-color",
          "font-family",
          "border-radius",
        ]
          .map((p) => p + ": " + (computed?.getPropertyValue(p) || "—"))
          .join("\n") +
        "\n\nHTML: " +
        node.file +
        ":" +
        node.location.startLine +
        "\nCSS: overrides locais em css/overrides.css; regras originais preservadas.";
      for (const input of q("properties").querySelectorAll("[data-css]")) {
        if (document.activeElement !== input)
          input.value = computed?.getPropertyValue(input.dataset.css) || "";
      }
    }
    function buildInspector() {
      const doc = getDocument(),
        canvas = getCanvas();
      q("properties").replaceChildren();
      const componentScope = document.createElement("label");
      componentScope.textContent = "Edição CSS";
      const componentSelect = document.createElement("select");
      componentSelect.id = "ws-component-scope";
      componentSelect.add(new Option("Instância selecionada", "instance"));
      componentSelect.add(new Option("Definição compartilhada", "definition"));
      componentScope.append(componentSelect);
      q("properties").append(componentScope);
      const originDetails = document.createElement("details"),
        originSummary = document.createElement("summary");
      originSummary.textContent = "Editar declaração original (compartilhada)";
      originDetails.append(originSummary);
      const originSelect = document.createElement("select"),
        originValue = document.createElement("input"),
        originApply = document.createElement("button");
      originSelect.setAttribute("aria-label", "Regra de origem");
      originValue.setAttribute("aria-label", "Valor da declaração original");
      originApply.type = "button";
      originApply.textContent = "Alterar declaração original";
      let originRules = [];
      originSelect.onchange = () => {
        const rule = originRules[Number(originSelect.value)];
        originValue.value = rule
          ? rule.value + (rule.important ? " !important" : "")
          : "";
      };
      originApply.onclick = () => {
        try {
          const rule = originRules[Number(originSelect.value)];
          if (!rule) throw Error("Foque uma propriedade com regra CSS mapeada");
          doc.editRule(rule, originValue.value);
        } catch (error) {
          fail(error);
        }
      };
      originDetails.append(originSelect, originValue, originApply);
      q("properties").append(originDetails);
      const importantLabel = document.createElement("label");
      importantLabel.textContent = "Override !important";
      const important = document.createElement("input");
      important.type = "checkbox";
      importantLabel.append(important);
      q("properties").append(importantLabel);
      const query = document.createElement("label");
      query.textContent = "Media query (vazio = global)";
      const input = document.createElement("input");
      input.id = "ws-media";
      input.placeholder = "(max-width: 768px)";
      query.append(input);
      q("properties").append(query);
      const scopeLabel = document.createElement("label");
      scopeLabel.textContent = "Tipo de query";
      const scopeSelect = document.createElement("select");
      scopeSelect.id = "ws-query-kind";
      scopeSelect.add(new Option("Media", "media"));
      scopeSelect.add(new Option("Container", "container"));
      scopeLabel.append(scopeSelect);
      q("properties").append(scopeLabel);
      const stateLabel = document.createElement("label");
      stateLabel.textContent = "Estado";
      const stateSelect = document.createElement("select");
      stateSelect.id = "ws-css-state";
      for (const value of [
        "",
        "hover",
        "focus",
        "active",
        "disabled",
        "checked",
      ])
        stateSelect.add(new Option(value || "Base", value));
      on(stateSelect, "change", () =>
        canvas.simulate(getSelected(), stateSelect.value),
      );
      stateLabel.append(stateSelect);
      q("properties").append(stateLabel);
      for (const [name, properties] of Object.entries(GROUPS)) {
        const details = document.createElement("details"),
          summary = document.createElement("summary");
        summary.textContent = name;
        details.append(summary);
        for (const property of properties) {
          const label = document.createElement("label");
          label.textContent = property;
          const input = document.createElement("input");
          input.dataset.css = property;
          on(input, "focus", () => {
            const selected = getSelected();
            if (!selected) return;
            const result = new global.AgataWebStyles.StyleResolver(
              doc,
              canvas,
            ).resolve(selected, property, getInstance());
            originRules = result.rules.filter(
              (r) => Number.isInteger(r.start) && Number.isInteger(r.end),
            );
            originSelect.replaceChildren(
              ...originRules.map(
                (r, i) =>
                  new Option(r.file + ":" + r.line + " " + r.selector, i),
              ),
            );
            originSelect.onchange();
            q("computed").textContent =
              property +
              ": " +
              result.value +
              "\n" +
              result.rules
                .map(
                  (r) =>
                    r.file +
                    ":" +
                    (r.line || "?") +
                    " " +
                    r.selector +
                    " { " +
                    r.property +
                    ": " +
                    r.value +
                    (r.important ? " !important" : "") +
                    " }" +
                    (r.active ? "" : " [media inativa]"),
                )
                .join("\n");
          });
          input.setAttribute("aria-label", property);
          on(input, "change", () => {
            const selected = getSelected(),
              selection = getSelection();
            try {
              if (!selected) throw Error("Selecione um elemento");
              if (!CSS.supports(property, input.value))
                throw Error("Valor CSS inválido: " + property);
              const media = q("media").value.trim();
              const scope = media
                ? (q("query-kind").value === "container" ? "@container " : "") +
                  media
                : "";
              if (media)
                global.AgataWebParsers.css.parse(
                  (scope.startsWith("@container") ? scope : "@media " + scope) +
                    "{x{color:red}}",
                );
              doc.transaction("Estilo " + property, () => {
                for (const id of selection)
                  doc.style(
                    id,
                    property,
                    input.value + (important.checked ? " !important" : ""),
                    scope,
                    q("css-state").value,
                    q("component-scope").value === "instance"
                      ? getInstance()
                      : null,
                  );
              });
            } catch (e) {
              fail(e);
            }
          });
          label.append(input);
          details.append(label);
        }
        q("properties").append(details);
      }
    }
    return { render: renderInspector, build: buildInspector };
  }
  global.AgataWebInspector = { create, GROUPS };
})(window);
