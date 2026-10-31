/* Entra/sai de um componente preservando coordenadas absolutas e associação.
   Dependência: Fabric.js 5.3 — util.applyTransformToObject e Group. */
window.AgataComponentEditing=(()=>{
 "use strict";
 let counter=0;
 const makeId=()=> "component_"+Date.now().toString(36)+"_"+(++counter).toString(36);
 function enter(canvas,group,fabric){
   if (!group || group.type!=="group" || !group.componentKind) {
     throw new Error("Selecione um componente para editar suas partes.");
   }
   const index=canvas.getObjects().indexOf(group);
   if(index<0)throw new Error("Componente não está na prancheta.");
   const componentId=group.componentId||makeId();
   const parts=group.getObjects().map(child=>{
     // calcTransformMatrix() inclui os transformes dos grupos ancestrais.
     const world=child.calcTransformMatrix();
     let object=child;
     if(child.type==="text"){
       const data=child.toObject(["componentRole","iconKind"]);
       object=new (fabric.IText)(child.text,data);
       object.componentRole=child.componentRole;
     }
     object.group=undefined;
     fabric.util.applyTransformToObject(object,world);
     object.setCoords();
     object.layerId=group.layerId;
     object.componentParentId=componentId;
     if(child.componentRole)object.componentRole=child.componentRole;
     return object;
   });
   // Compatibilidade com componentes já salvos pela primeira versão do Agata.
   // Antigos rótulos continham ícones e itens unidos num único Text.
   const factory=window.AgataSketchComponents;
   const attach=object=>{
     object.componentParentId=componentId;
     object.layerId=group.layerId;
     object.setCoords();
     parts.push(object);
   };
   const background=parts.find(item=>item.type==="rect");
   if(group.componentKind==="topbar"){
     const merged=parts.find(item=>typeof item.text==="string" && item.text.includes("☰"));
     if(merged && factory){
       const x=merged.left,y=merged.top;
       merged.set("text",merged.text.replace(/^☰\s*/,""));
       merged.set("left",x+31);
       merged.setCoords();
       attach(factory.icon("menu",{left:x,top:y+2,stroke:"#ffffff"}));
     }
   }
   if(group.componentKind==="sidebar"){
     const merged=parts.find(item=>typeof item.text==="string" && item.text.includes("\n\n"));
     if(merged){
       const [first,...more]=merged.text.split(/\n+/).filter(Boolean);
       merged.set("text",first);
       merged.setCoords();
       more.forEach((line,i)=>{
         const text=new (fabric.IText)(line,{
           left:merged.left,top:merged.top+(i+1)*35,
           fontFamily:merged.fontFamily,fontSize:merged.fontSize,fill:merged.fill
         });
         text.componentRole="item";
         attach(text);
       });
     }
   }
   if(group.componentKind==="bottom" && factory && background){
     const old=parts.find(item=>typeof item.text==="string" && item.text.includes("⌂"));
     if(old){
       parts.splice(parts.indexOf(old),1);
       const x=background.left,y=background.top,w=background.getScaledWidth();
       attach(factory.icon("home",{left:x+37,top:y+22,stroke:"#236773"}));
       attach(factory.icon("grid",{left:x+w/2-9,top:y+22,stroke:"#236773"}));
       attach(factory.icon("settings",{left:x+w-55,top:y+22,stroke:"#236773"}));
     }
   }
   if(group.componentKind==="button" && factory && background &&
      !parts.some(part=>part.componentRole==="icon")){
      attach(factory.icon("plus",{left:background.left+18,top:background.top+15,stroke:"#ffffff"}));
   }
   canvas.remove(group);
   parts.forEach((part,offset)=>canvas.insertAt(part,index+offset,false));
   canvas.requestRenderAll();
   return {id:componentId,kind:group.componentKind,layerId:group.layerId,index};
 }
 function finish(canvas,session,fabric){
   const parts=canvas.getObjects().filter(o=>o.componentParentId===session.id);
   const indices=parts.map(o=>canvas.getObjects().indexOf(o)).filter(i=>i>=0);
   const index=Math.min(session.index,...indices);
   if (!parts.length) return null;
   for(const obj of parts){
     canvas.remove(obj);
     delete obj.componentParentId;
     delete obj.layerId;
   }
   const group=new (fabric.Group)(parts,{objectCaching:false});
   group.componentKind=session.kind;
   group.componentId=session.id;
   group.layerId=session.layerId;
   canvas.insertAt(group,Math.min(index,canvas.getObjects().length),false);
   group.setCoords();canvas.requestRenderAll();
   return group;
 }
 function link(object,session){
   if(!session || !object || object.type==="activeSelection")return false;
   if(object.componentParentId===session.id || object.type==="group")return false;
   if(object.layerId!==session.layerId)return false;
   object.componentParentId=session.id;
   return true;
 }
 function unlink(object,session){
   if (!session || !object || object.componentParentId!==session.id)return false;
   delete object.componentParentId;
   return true;
 }
 return {enter,finish,link,unlink,newId:makeId};
})();
