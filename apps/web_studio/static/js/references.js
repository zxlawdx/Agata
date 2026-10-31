/* Minimal location-based patches for recognized local references after file moves. */
(function (global) {
  "use strict";
  function relative(from, to) {
    const base = from.split("/").slice(0, -1),
      target = to.split("/");
    while (base.length && target.length && base[0] === target[0]) {
      base.shift();
      target.shift();
    }
    return (
      [...base.map(() => ".."), ...target].map(encodeURIComponent).join("/") ||
      "./"
    );
  }
  function rewrite(doc, moves) {
    const reverse = new Map([...moves].map(([a, b]) => [b, a])),
      css = global.AgataWebParsers.css,
      html = global.AgataWebParsers.html;
    for (const [file, entry] of [...doc.files]) {
      if (entry.encoding !== "utf8") continue;
      const oldFile = reverse.get(file) || file,
        patches = [];
      const transform = (value) => {
        if (
          !value ||
          value.startsWith("#") ||
          value.startsWith("//") ||
          /^[a-z][a-z0-9+.-]*:/i.test(value)
        )
          return value;
        try {
          const url = new URL(value, "https://agata.invalid/" + oldFile),
            oldTarget = decodeURIComponent(url.pathname.slice(1)),
            target = moves.get(oldTarget) || oldTarget;
          if (!doc.files.has(target)) return value;
          return (
            (value.startsWith("/")
              ? "/" + target.split("/").map(encodeURIComponent).join("/")
              : relative(file, target)) +
            url.search +
            url.hash
          );
        } catch {
          return value;
        }
      };
      try {
        if (/\.html?$/i.test(file)) {
          const ast = html.parse(entry.content, {
            sourceCodeLocationInfo: true,
          });
          const visit = (n) => {
            for (const attr of n.attrs || []) {
              if (!["src", "href", "poster", "action"].includes(attr.name))
                continue;
              const value = transform(attr.value),
                loc = n.sourceCodeLocation?.attrs?.[attr.name];
              if (value !== attr.value && loc)
                patches.push({
                  start: loc.startOffset,
                  end: loc.endOffset,
                  text:
                    attr.name +
                    '="' +
                    global.AgataWebDomain.escape(value) +
                    '"',
                });
            }
            for (const c of n.childNodes || []) visit(c);
          };
          visit(ast);
        } else if (/\.css$/i.test(file)) {
          const ast = css.parse(entry.content, { positions: true });
          css.walk(ast, (n) => {
            if (n.type === "Url") {
              const value = transform(n.value);
              if (value !== n.value)
                patches.push({
                  start: n.loc.start.offset,
                  end: n.loc.end.offset,
                  text: "url(" + JSON.stringify(value) + ")",
                });
            }
            if (n.type === "Atrule" && n.name === "import") {
              const string = n.prelude?.children.first;
              if (string?.type === "String") {
                const value = transform(string.value);
                if (value !== string.value)
                  patches.push({
                    start: string.loc.start.offset,
                    end: string.loc.end.offset,
                    text: JSON.stringify(value),
                  });
              }
            }
          });
        } else if (/\.m?js$/i.test(file)) {
          const [imports] = global.AgataWebParsers.modules(entry.content);
          for (const imp of imports) {
            if (!imp.n || !/^\.?\.?\//.test(imp.n)) continue;
            let value = transform(imp.n);
            if (!value.startsWith(".") && !value.startsWith("/"))
              value = "./" + value;
            if (value !== imp.n)
              patches.push({
                start: imp.s,
                end: imp.e,
                text: imp.d === -1 ? value : JSON.stringify(value),
              });
          }
        }
        let after = entry.content;
        for (const p of patches.sort((a, b) => b.start - a.start))
          after = after.slice(0, p.start) + p.text + after.slice(p.end);
        if (after !== entry.content)
          doc.edit(file, after, "Atualizar referência local");
      } catch (error) {
        doc.diagnostics.push({
          file,
          message:
            "Referências preservadas; ajuste manual necessário: " +
            error.message,
        });
      }
    }
  }
  global.AgataWebReferences = { rewrite, relative };
})(typeof window === "undefined" ? globalThis : window);
