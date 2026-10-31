/* Verifica que nenhum controle definido no editor fique sem uma ligação funcional.
   Não substitui um teste visual no Linux, mas detecta IDs órfãos no template. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("apps/sketch_editor/templates/editor.html","utf8");
const js=fs.readFileSync("apps/sketch_editor/static/js/editor.js","utf8");
const ids=[
 "ys-save","ys-home","ys-undo","ys-redo","ys-zoom-out","ys-zoom-in","ys-fit",
 "ys-edit-component","ys-finish-component","ys-add-icon","ys-link-component",
 "ys-unlink-component","ys-prop-text","ys-font-size","ys-corner-radius",
 "ys-bring-front","ys-send-back","ys-duplicate","ys-delete",
 "ys-layer-up","ys-layer-down","ys-add-layer","ys-layer-rename",
 "ys-layer-duplicate","ys-layer-delete","ys-color","ys-brush-size",
 "ys-prop-x","ys-prop-y","ys-prop-w","ys-prop-h"
];
test("todas as ações do editor estão presentes no template e ligadas no código",()=>{
 for(const id of ids){
   assert.match(html,new RegExp('id="'+id+'"'),"campo ausente: "+id);
   assert.ok(js.includes('get("'+id+'")') || js.includes('["'+id+'"'),
      "controle sem ligação: "+id);
 }
});
test("todas as ferramentas e componentes do template são manipulados",()=>{
 assert.match(html,/data-tool="select"/);
 assert.match(html,/data-tool="pen"/);
 assert.match(html,/data-component="button"/);
 assert.match(js,/\[data-tool\]/);
 assert.match(js,/\[data-component\]/);
 assert.match(js,/\[data-align\]/);
 assert.match(html,/data-align="hcenter"/);
});
test("scripts de modelo são carregados antes do controlador",()=>{
 const names=["fabric.js","sketch_core.js","components.js","component_edit.js","element_tree.js","editor.js"];
 let last=-1;
 for(const name of names){
   const i=html.indexOf("'sketch_editor/",last+1);
   assert.notEqual(i,-1,"faltando arquivo "+name);
   const found=html.indexOf(name,i);
   assert.notEqual(found,-1);
   assert.ok(found>last);
   last=found;
 }
});
