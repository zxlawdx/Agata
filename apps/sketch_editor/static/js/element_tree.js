/* Hierarquia de objetos do editor Yara — modelo independente de HTML e eventos.
   Base conceitual: árvores de nós de Craft.js e Layer Manager do GrapesJS.
   Os objetos continuam sendo entidades Fabric; não há dependência React. */
window.YaraElementTree = (() => {
  "use strict";
  const ids = new WeakMap();
  let count=0;
  const key = obj => {
    if (!ids.has(obj)) ids.set(obj,"node_"+(++count));
    return ids.get(obj);
  };
  const TYPES = {rect:"Retângulo",ellipse:"Elipse",path:"Ícone/Traço",line:"Linha",
    "i-text":"Texto",textbox:"Texto",text:"Texto",group:"Grupo"};
  const ROLES = {background:"Fundo",icon:"Ícone",title:"Título",description:"Descrição",
    placeholder:"Placeholder",label:"Rótulo",item:"Item"};
  const COMPONENTS = {topbar:"Top Bar",sidebar:"Sidebar",bottom:"Bottom Bar",
    button:"Botão",card:"Cartão",input:"Campo"};
  function name(obj){
    if(obj.componentKind)return COMPONENTS[obj.componentKind]||"Componente";
    if(obj.componentRole)return ROLES[obj.componentRole]||"Elemento";
    if(typeof obj.text==="string")return "Texto: "+(obj.text.replace(/\s+/g," ").slice(0,24)||"vazio");
    return TYPES[obj.type]||"Objeto";
  }
  function describe(objects,layers){
    const byLayer=new Map(layers.map(l=>[l.id,{id:l.id,name:l.name,visible:l.visible,locked:l.locked,children:[]}]));
    for(const obj of objects){
      const layer=byLayer.get(obj.layerId);
      if(!layer)continue;
      const item={
        id:key(obj),name:name(obj),object:obj,component:!!obj.componentKind,
        kind:obj.type,children:[]
      };
      if(obj.type==="group" && typeof obj.getObjects==="function"){
        item.children=obj.getObjects().map(child=>({
          id:key(child),name:name(child),object:child,component:false,
          kind:child.type,children:[]
        }));
      }
      layer.children.push(item);
    }
    return [...byLayer.values()].reverse().map(l=>({
      ...l,children:l.children.slice().reverse()
    }));
  }
  function move(canvas,obj,step){
    if(!obj || ![-1,1].includes(step))return false;
    const objects=canvas.getObjects();
    const same=objects.filter(item=>item.layerId===obj.layerId
      && item.componentParentId===obj.componentParentId);
    const idx=same.indexOf(obj);
    const adjacent=same[idx+step];
    if(idx<0 || !adjacent)return false;
    const otherIndex=objects.indexOf(adjacent);
    canvas.moveTo(obj,otherIndex);
    canvas.requestRenderAll();
    return true;
  }
  function align(object,width,height,mode){
    if(!object || !["left","hcenter","right","top","vcenter","bottom"].includes(mode))
      return false;
    object.setCoords();
    const box=object.getBoundingRect(true,true);
    let dx=0,dy=0;
    if(mode==="left")dx=-box.left;
    if(mode==="hcenter")dx=(width-box.width)/2-box.left;
    if(mode==="right")dx=width-(box.left+box.width);
    if(mode==="top")dy=-box.top;
    if(mode==="vcenter")dy=(height-box.height)/2-box.top;
    if(mode==="bottom")dy=height-(box.top+box.height);
    object.set({left:object.left+dx,top:object.top+dy});
    object.setCoords();
    return true;
  }
  return {name,describe,move,align};
})();
