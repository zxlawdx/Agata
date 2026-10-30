const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync("apps/sketch_editor/static/js/element_tree.js","utf8"),ctx);
const tree=ctx.window.YaraElementTree;
test("hierarquia lista camadas, componentes e filhos sem perder os objetos",()=>{
 const text={type:"i-text",text:"Salvar",componentRole:"label"};
 const icon={type:"path",componentRole:"icon"};
 const group={type:"group",componentKind:"button",layerId:"ui",getObjects(){return [icon,text]}};
 const document=tree.describe([group],[{id:"ui",name:"Interface",visible:true,locked:false}]);
 assert.equal(document[0].name,"Interface");
 assert.equal(document[0].children[0].name,"Botão");
 assert.deepEqual(document[0].children[0].children.map(x=>x.name),["Ícone","Rótulo"]);
 assert.strictEqual(document[0].children[0].children[1].object,text);
});
test("ordem só muda entre objetos da mesma camada e vínculo",()=>{
 const a={layerId:"ui"},b={layerId:"notes"},c={layerId:"ui"};
 const objects=[a,b,c];
 const canvas={getObjects:()=>objects,moveTo(o,index){objects.splice(objects.indexOf(o),1);objects.splice(index,0,o);},requestRenderAll(){}};
 assert.equal(tree.move(canvas,a,1),true);
 assert.equal(objects.indexOf(a)>objects.indexOf(c),true);
 assert.equal(tree.move(canvas,a,1),false);
 assert.equal(objects[0],b);
});
test("alinhamento considera caixa real do objeto",()=>{
 const obj={left:20,top:40,getBoundingRect(){return {left:this.left,top:this.top,width:80,height:30};},set(v){Object.assign(this,v);},setCoords(){}};
 assert.equal(tree.align(obj,400,800,"hcenter"),true);assert.equal(obj.left,160);
 tree.align(obj,400,800,"bottom");assert.equal(obj.top,770);
 assert.equal(tree.align(obj,400,800,"unknown"),false);
});
