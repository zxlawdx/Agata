/* Modelos gráficos: referências de UI, não layouts exportáveis. */
window.YaraSketchComponents = (() => {
  "use strict";
  const f = () => window.fabric;
  function label(text, opts={}) {
    return new (f().Text)(text, {fontFamily:"Inter, Arial",fontSize:14,fill:"#243e42",...opts});
  }
  function shape(options) {
    return new (f().Rect)({rx:7,ry:7,strokeWidth:0,...options});
  }
  function build(type,color,width=390,height=844) {
    let objects=[], x=24, y=72;
    const screenW=Math.max(100,width-48);
    const transparent={fill:"transparent",stroke:"#a9bec2",strokeWidth:1};
    if(type==="topbar"){
      x=12;y=14;
      objects=[shape({width:width-24,height:54,fill:color,rx:8,ry:8}),
        label("☰  Minha aplicação",{left:15,top:19,fontSize:15,fill:"#ffffff"})];
    }else if(type==="sidebar"){
      x=12;y=80;
      objects=[shape({width:Math.max(70,Math.min(135,width*.35)),height:Math.min(440,height-95),fill:"#e7f3f4",stroke:"#a5ced1",strokeWidth:1}),
        label("MENU",{left:13,top:17,fontSize:13,fill:"#174e56"}),
        label("Início\n\nProjetos\n\nConfigurações",{left:13,top:59,fontSize:12,fill:"#527a80"})];
    }else if(type==="bottom"){
      x=12;y=Math.max(10,height-85);
      objects=[shape({width:width-24,height:60,fill:"#e0f3f4",rx:12,ry:12}),
        label("⌂         ▦         ⚙",{left:15,top:20,fontSize:16,fill:"#236773"})];
    }else if(type==="button"){
      objects=[shape({width:Math.min(220,screenW),height:48,fill:color}),
        label("Botão",{left:63,top:15,fontSize:15,fill:"#ffffff"})];
    }else if(type==="card"){
      objects=[shape({width:Math.min(260,screenW),height:145,fill:"#ffffff",stroke:"#b1d1d4",strokeWidth:2,rx:13,ry:13}),
        label("Título do cartão",{left:16,top:16,fontSize:16}),
        label("Descrição ou conteúdo",{left:16,top:55,fontSize:12,fill:"#697f82"})];
    }else if(type==="input"){
      objects=[shape({width:Math.min(250,screenW),height:48,fill:"#ffffff",stroke:"#a2bec2",strokeWidth:1}),
        label("Digite aqui...",{left:12,top:15,fontSize:13,fill:"#859b9d"})];
    }else throw Error("Componente inexistente.");
    const group=new (f().Group)(objects,{left:x,top:y,objectCaching:false});
    group.componentKind=type;
    return group;
  }
  return {build};
})();
