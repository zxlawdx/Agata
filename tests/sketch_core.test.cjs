const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = {window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync("apps/sketch_editor/static/js/sketch_core.js","utf8"),context);
const core = context.window.AgataSketchCore;
test("projeto legado ganha camadas sem modificar o registro anterior",()=>{
  const screen = {elements: []};
  const state = core.upgrade(screen);
  assert.equal(state.layers.length,3);
  assert.equal(state.layers[1].name,"Interface");
  assert.equal(state.activeLayerId,state.layers[1].id);
  assert.equal(screen.layers,undefined);
});
test("bloqueio e visibilidade impedem a edição da camada ativa",()=>{
  const state=core.upgrade({});
  assert.equal(core.editable(state),true);
  core.find(state).locked=true;
  assert.equal(core.editable(state),false);
  core.find(state).locked=false;
  core.find(state).visible=false;
  assert.equal(core.editable(state),false);
});
test("reordenar preserva ids, objetos e camada ativa",()=>{
  const state=core.upgrade({});
  const id=state.activeLayerId;
  core.find(state).objects.push({type:"rect",width:20});
  assert.equal(core.move(state,1),true);
  assert.equal(state.layers[2].id,id);
  assert.equal(core.find(state).objects.length,1);
});
test("duplicar camada gera identidade independente",()=>{
  const state=core.upgrade({});
  const original=core.find(state);
  original.objects.push({type:"rect",width:20});
  const copy=core.duplicate(state);
  assert.notEqual(copy.id,original.id);
  copy.objects[0].width=33;
  assert.equal(original.objects[0].width,20);
});
test("não permite remover a última camada",()=>{
  const state=core.upgrade({});
  core.remove(state);core.remove(state);
  assert.throws(()=>core.remove(state),/pelo menos uma camada/);
});
