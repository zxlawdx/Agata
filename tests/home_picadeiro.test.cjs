// Contrato básico de controles do home Picadeiro Pop.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("apps/home/templates/home.html","utf8");
const js=fs.readFileSync("apps/home/static/agata.js","utf8");
test("home tem criação e navegação ligadas",()=>{
for(const id of ["agata-create","agata-create-dialog","agata-create-form","agata-name",
"agata-mode","agata-platform","agata-width","agata-height","agata-confirm-create",
"agata-project-list","agata-view-all","agata-close-create","agata-cancel-create"]){
 assert.ok(html.includes('id="'+id+'"'),id+" ausente do template");
 assert.ok(js.includes('"'+id+'"'),id+" ausente da lógica");
}
assert.match(js,/create_project/);assert.match(js,/list_projects/);assert.match(js,/navigate\("\/sketch"/);
});
test("navegação para funcionalidades em desenvolvimento não finge estar pronta",()=>{
 assert.match(html,/Fluxo de App[^<]*<span class="agata-soon">em breve/);
 assert.match(html,/data-editor-mode="svg"/);
 assert.match(html,/data-section="templates"/);
});
