// Contrato básico de controles do home Picadeiro Pop.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("apps/home/templates/home.html","utf8");
const js=fs.readFileSync("apps/home/static/yara.js","utf8");
test("home tem criação e navegação ligadas",()=>{
for(const id of ["yara-create","yara-create-dialog","yara-create-form","yara-name",
"yara-mode","yara-platform","yara-width","yara-height","yara-confirm-create",
"yara-project-list","yara-view-all","yara-close-create","yara-cancel-create"]){
 assert.ok(html.includes('id="'+id+'"'),id+" ausente do template");
 assert.ok(js.includes('"'+id+'"'),id+" ausente da lógica");
}
assert.match(js,/create_project/);assert.match(js,/list_projects/);assert.match(js,/navigate\("\/sketch"/);
});
test("navegação para funcionalidades em desenvolvimento não finge estar pronta",()=>{
 assert.match(html,/Fluxo de App[^<]*<span class="yara-soon">em breve/);
 assert.match(html,/data-editor-mode="svg"/);
 assert.match(html,/data-section="templates"/);
});
