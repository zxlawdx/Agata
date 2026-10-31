/* Testes de contrato da fábrica e vínculos entre partes de componentes. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

class FakeObj {
  constructor(...args){this.args=args;this.type="object";if(args.length===2&&typeof args[1]==="object")Object.assign(this,args[1]);
    else if(args.length===1&&typeof args[0]==="object")Object.assign(this,args[0]);}
  setCoords(){}
  set(key,value){this[key]=value;return this;}
  getScaledWidth(){return this.width||0;}
  toObject(){return {...this};}
  calcTransformMatrix(){return [1,0,0,1,this.left||0,this.top||0];}
}
class FakeIText extends FakeObj {constructor(text,props){super(props);this.type="i-text";this.text=text;}}
class FakeRect extends FakeObj{constructor(props){super(props);this.type="rect";}}
class FakePath extends FakeObj{constructor(path,props){super(props);this.type="path";this.path=path;}}
class FakeGroup extends FakeObj{
  constructor(parts,props){super(props);this.type="group";this.parts=parts;}
  getObjects(){return this.parts;}
}
const fabric={
 IText:FakeIText,Text:FakeIText,Rect:FakeRect,Path:FakePath,Group:FakeGroup,
 util:{applyTransformToObject(obj,m){obj.left=m[4];obj.top=m[5];}}
};
const context={window:{fabric},Date};
vm.createContext(context);
for(const file of ["components.js","component_edit.js"]){
  vm.runInContext(fs.readFileSync("apps/sketch_editor/static/js/"+file,"utf8"),context);
}
const factory=context.window.YaraSketchComponents;
const edit=context.window.YaraComponentEditing;
class FakeCanvas {
 constructor(objects){this.objects=[...objects];}
 getObjects(){return this.objects;}
 remove(obj){const i=this.objects.indexOf(obj);if(i>=0)this.objects.splice(i,1);}
 insertAt(obj,index){this.objects.splice(index,0,obj);}
 requestRenderAll(){}
}
test("botão contém texto e ícone como objetos separados",()=>{
  const btn=factory.build("button","#0097a7",390,844);
  const roles=btn.getObjects().map(item=>item.componentRole);
  assert.deepEqual([...roles].sort(),["background","icon","label"]);
  assert.equal(btn.getObjects().find(item=>item.componentRole==="label").type,"i-text");
  assert.equal(btn.getObjects().find(item=>item.componentRole==="icon").type,"path");
});
test("barra de navegação contém três ícones vetoriais separáveis",()=>{
  const bar=factory.build("bottom","#0097a7");
  assert.equal(bar.getObjects().filter(item=>item.componentRole==="icon").length,3);
});
test("entrar e concluir preserva as partes e vincula movimento do grupo",()=>{
  const btn=factory.build("button","#0097a7");
  btn.layerId="layer_a";
  const canvas=new FakeCanvas([btn]);
  const session=edit.enter(canvas,btn,fabric);
  assert.equal(canvas.getObjects().length,3);
  const icon=canvas.getObjects().find(item=>item.componentRole==="icon");
  assert.equal(icon.componentParentId,session.id);
  icon.left+=25;
  const result=edit.finish(canvas,session,fabric);
  assert.equal(canvas.getObjects().length,1);
  assert.equal(result.componentKind,"button");
  assert.equal(result.componentId,session.id);
  assert.equal(result.getObjects().find(item=>item.componentRole==="icon").left,icon.left);
});
test("barra antiga separa texto/ícone durante a edição",()=>{
  const bg=new FakeRect({left:0,top:0,width:250,height:54});
  const merged=new FakeIText("☰  Minha aplicação",{left:15,top:19});
  merged.type="text";
  const group=new FakeGroup([bg,merged],{left:12,top:14});
  group.componentKind="topbar";
  group.layerId="A";
  const canvas=new FakeCanvas([group]);
  const session=edit.enter(canvas,group,fabric);
  assert.equal(canvas.getObjects().filter(x=>x.componentRole==="icon").length,1);
  assert.equal(canvas.getObjects().find(x=>x.type==="i-text").text,"Minha aplicação");
  assert.equal(edit.finish(canvas,session,fabric).getObjects().length,3);
});
test("vincular e desvincular elemento externo",()=>{
  const btn=factory.build("button","#0097a7");btn.layerId="A";
  const canvas=new FakeCanvas([btn]);
  const session=edit.enter(canvas,btn,fabric);
  const outside=new FakePath("M 0 0 L 10 10",{left:88,top:66});
  outside.layerId="A";canvas.insertAt(outside,4);
  assert.equal(edit.link(outside,session),true);
  assert.equal(edit.finish(canvas,session,fabric).getObjects().length,4);
  const newSession=edit.enter(canvas,canvas.getObjects()[0],fabric);
  const icon=canvas.getObjects().find(x=>x.componentRole==="icon");
  assert.equal(edit.unlink(icon,newSession),true);
  edit.finish(canvas,newSession,fabric);
  assert.equal(canvas.getObjects().length,2);
});
