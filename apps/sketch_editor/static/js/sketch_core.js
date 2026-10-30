/* Modelo de camadas desacoplado da biblioteca de desenho. */
(() => {
  "use strict";
  let sequence = 0;
  const uid = () => "layer_" + Date.now().toString(36) + "_" + (++sequence).toString(36);
  const layer = (name, extra = {}) => ({
    id: uid(), name, visible: true, locked: false, objects: [], ...extra
  });
  function upgrade(screen) {
    if (Array.isArray(screen?.layers) && screen.layers.length) {
      const layers = screen.layers.map(item => ({
        id: item.id, name: item.name, visible: item.visible !== false,
        locked: item.locked === true, objects: Array.isArray(item.objects) ? item.objects : []
      }));
      const active = layers.some(item => item.id === screen.active_layer_id)
        ? screen.active_layer_id : layers[0].id;
      return {layers, activeLayerId: active};
    }
    const background = layer("Fundo", {locked: true});
    const interfaceLayer = layer("Interface");
    const notes = layer("Anotações");
    return {layers: [background, interfaceLayer, notes], activeLayerId: interfaceLayer.id};
  }
  const find = (state, id = state.activeLayerId) => state.layers.find(item => item.id === id);
  const editable = state => {
    const current = find(state);
    return Boolean(current?.visible && !current.locked);
  };
  function add(state, name = "Nova camada") {
    if (state.layers.length >= 80) throw new Error("Limite de 80 camadas.");
    const created = layer(name);
    state.layers.push(created);
    state.activeLayerId = created.id;
    return created;
  }
  function duplicate(state) {
    const original = find(state);
    if (!original) return null;
    if (state.layers.length >= 80) throw new Error("Limite de 80 camadas.");
    const copy = layer(original.name + " (cópia)", {
      visible: original.visible, locked: false,
      objects: JSON.parse(JSON.stringify(original.objects))
    });
    state.layers.splice(state.layers.indexOf(original) + 1, 0, copy);
    state.activeLayerId = copy.id;
    return copy;
  }
  function remove(state) {
    if (state.layers.length === 1) throw new Error("O esboço precisa de pelo menos uma camada.");
    const index = state.layers.findIndex(item => item.id === state.activeLayerId);
    if (index < 0) return null;
    const removed = state.layers.splice(index, 1)[0];
    state.activeLayerId = state.layers[Math.min(index, state.layers.length - 1)].id;
    return removed;
  }
  function move(state, direction) {
    const index = state.layers.findIndex(item => item.id === state.activeLayerId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= state.layers.length) return false;
    [state.layers[index], state.layers[next]] = [state.layers[next], state.layers[index]];
    return true;
  }
  window.YaraSketchCore = {upgrade, layer, find, editable, add, duplicate, remove, move};
})();
