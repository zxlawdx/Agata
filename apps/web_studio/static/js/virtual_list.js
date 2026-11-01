/* Bounded DOM rows for large explorers; item data remains in the domain model. */
(function (global) {
  "use strict";
  function renderList(host, items, build) {
    const top = host.scrollTop;
    host.onscroll = null;
    if (items.length < 200) {
      host.style.maxHeight = "";
      host.style.overflow = "";
      host.replaceChildren(...items.map(build));
      return;
    }
    const rowHeight = 28;
    host.style.maxHeight = "360px";
    host.style.overflow = "auto";
    const spacer = document.createElement("div");
    spacer.style.cssText =
      "position:relative;height:" + items.length * rowHeight + "px";
    host.replaceChildren(spacer);
    const draw = () => {
      const first = Math.max(0, Math.floor(host.scrollTop / rowHeight) - 8),
        last = Math.min(
          items.length,
          first + Math.ceil((host.clientHeight || 360) / rowHeight) + 16,
        ),
        children = [];
      for (let i = first; i < last; i++) {
        const row = build(items[i], i);
        row.style.position = "absolute";
        row.style.top = i * rowHeight + "px";
        row.style.height = rowHeight + "px";
        row.style.width = "100%";
        children.push(row);
      }
      spacer.replaceChildren(...children);
    };
    host.onscroll = draw;
    host.scrollTop = top;
    draw();
  }
  global.AgataWebLists = { renderList };
})(window);
