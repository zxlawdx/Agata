// Integração visual e de eventos do Picadeiro Pop no template.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("apps/sketch_editor/templates/editor.html","utf8");
const js=fs.readFileSync("apps/sketch_editor/static/js/editor.js","utf8");
const css=fs.readFileSync("apps/sketch_editor/static/picadeiro.css","utf8");
test("botões de exportação, navegação e grade possuem manipuladores",()=>{
 for(const id of ["ys-go-new","ys-go-recents","ys-go-models","ys-export-svg","ys-export-png",
 "ys-export-json","ys-toggle-grid","ys-pick-color"]){
   assert.ok(html.includes('id="'+id+'"'),"sem botão: "+id);
   assert.ok(js.includes('get("'+id+'")') || js.includes('get("ys-export-"+format)'),
     "sem ação: "+id);
 }
 assert.match(js,/api\.export_artwork/);
 assert.match(js,/canvas\.toSVG\(\{suppressPreamble:true\}\)/);
});
test("formas e cores funcionais estão conectadas ao motor gráfico",()=>{
 for(const tool of ["triangle","diamond"]){
  assert.ok(html.includes('data-tool="'+tool+'"'));
  assert.ok(js.includes('kind === "'+tool+'"'));
 }
 for(const hex of ["#53AFF2","#96E6EC","#FFCCCF","#B9EFC1","#FFE28A","#BCACF5","#FFF9EF"]){
   assert.ok(html.includes('data-swatch="'+hex+'"'));
   assert.ok(css.includes(hex));
 }
 assert.match(js,/dispatchEvent\(new Event\("change"/);
});
