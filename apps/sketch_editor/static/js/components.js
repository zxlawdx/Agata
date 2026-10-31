/* Componentes editáveis: cada detalhe é um objeto vetorial ou texto individual. */
window.AgataSketchComponents = (() => {
 "use strict";
 const f = () => window.fabric;
 let serial=0;
 const id=()=> "component_"+Date.now().toString(36)+"_"+(++serial).toString(36);
 function text(value, role, options={}) {
   const item = new (f().IText)(value, {
     fontFamily:"Inter, Arial", fontSize:14, fill:"#243e42", ...options
   });
   item.componentRole=role;
   return item;
 }
 function rectangle(role, options={}) {
   const item = new (f().Rect)({
     left:0,top:0,rx:7,ry:7,strokeWidth:0,...options
   });
   item.componentRole=role;
   return item;
 }
 function icon(name="menu",options={}) {
   const paths={
     menu:"M 0 0 L 18 0 M 0 7 L 18 7 M 0 14 L 18 14",
     home:"M 0 9 L 9 1 L 18 9 M 3 8 L 3 18 L 15 18 L 15 8",
     grid:"M 0 0 L 7 0 L 7 7 L 0 7 Z M 11 0 L 18 0 L 18 7 L 11 7 Z M 0 11 L 7 11 L 7 18 L 0 18 Z M 11 11 L 18 11 L 18 18 L 11 18 Z",
     settings:"M 9 0 L 9 18 M 0 9 L 18 9 M 2 2 L 16 16 M 16 2 L 2 16",
     plus:"M 9 0 L 9 18 M 0 9 L 18 9"
   };
   if(!paths[name]) throw Error("Ícone desconhecido.");
   const item=new (f().Path)(paths[name], {
     fill:"transparent",stroke:"#ffffff",strokeWidth:2.3,strokeLineCap:"round",
     strokeLineJoin:"round",...options
   });
   item.componentRole="icon";
   item.iconKind=name;
   return item;
 }
 function make(type,color,width=390,height=844) {
   let parts=[],x=24,y=72;
   const inner=Math.max(100,width-48);
   if(type==="topbar"){
     x=12;y=14;
     parts=[
       rectangle("background",{width:width-24,height:54,fill:color}),
       icon("menu",{left:15,top:19}),
       text("Minha aplicação","title",{left:47,top:18,fontSize:15,fill:"#ffffff"})
     ];
   }else if(type==="sidebar"){
     x=12;y=80;
     const w=Math.max(70,Math.min(135,width*.35));
     parts=[
       rectangle("background",{width:w,height:Math.min(440,height-95),fill:"#e7f3f4",stroke:"#a5ced1",strokeWidth:1}),
       text("MENU","title",{left:13,top:17,fontSize:13,fill:"#174e56"}),
       text("Início","item",{left:13,top:59,fontSize:12,fill:"#527a80"}),
       text("Projetos","item",{left:13,top:94,fontSize:12,fill:"#527a80"}),
       text("Configurações","item",{left:13,top:129,fontSize:12,fill:"#527a80"})
     ];
   }else if(type==="bottom"){
     x=12;y=Math.max(10,height-85);
     parts=[
       rectangle("background",{width:width-24,height:60,fill:"#e0f3f4",rx:12,ry:12}),
       icon("home",{left:40,top:22,stroke:"#236773",scaleX:.85,scaleY:.85}),
       icon("grid",{left:Math.round((width-24)/2)-8,top:22,stroke:"#236773",scaleX:.85,scaleY:.85}),
       icon("settings",{left:width-74,top:22,stroke:"#236773",scaleX:.85,scaleY:.85})
     ];
   }else if(type==="button"){
     parts=[
       rectangle("background",{width:Math.min(220,inner),height:48,fill:color}),
       icon("plus",{left:18,top:15}),
       text("Botão","label",{left:52,top:15,fontSize:15,fill:"#ffffff"})
     ];
   }else if(type==="card"){
     parts=[
       rectangle("background",{width:Math.min(260,inner),height:145,fill:"#ffffff",stroke:"#b1d1d4",strokeWidth:2,rx:13,ry:13}),
       text("Título do cartão","title",{left:16,top:16,fontSize:16}),
       text("Descrição ou conteúdo","description",{left:16,top:55,fontSize:12,fill:"#697f82"})
     ];
   }else if(type==="input"){
     parts=[
       rectangle("background",{width:Math.min(250,inner),height:48,fill:"#ffffff",stroke:"#a2bec2",strokeWidth:1}),
       text("Digite aqui...","placeholder",{left:12,top:15,fontSize:13,fill:"#859b9d"})
     ];
   }else throw Error("Componente inexistente.");
   const group=new (f().Group)(parts,{left:x,top:y,objectCaching:false});
   group.componentKind=type;
   group.componentId=id();
   return group;
 }
 return {build:make,icon, text};
})();
