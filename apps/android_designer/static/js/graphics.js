/* SVG is a renderer for structured Shape/Chart data, never stored as a screenshot. */
window.AgataGraphics=(()=>{
 const NS='http://www.w3.org/2000/svg',svg=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
 function path(p,w,h){
  const points=count=>Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count-Math.PI/2,r=p.kind==='star'&&i%2?.22:.48;return [w/2+Math.cos(a)*w*r,h/2+Math.sin(a)*h*r];});
  if(['path','pencil'].includes(p.kind))return p.path.map(c=>c.join(' ')).join(' ');
  const pts=p.kind==='triangle'?[[w/2,0],[w,h],[0,h]]:points(p.kind==='star'?10:6);return 'M'+pts.map(x=>x.join(' ')).join(' L')+' Z';
 }
 function shape(n,w,h){const p=n.props,g=svg('g',{opacity:p.opacity,transform:`rotate(${p.rotation} ${w/2} ${h/2})`}),attrs={fill:p.fill,stroke:p.stroke,'stroke-width':p.strokeWidth,'stroke-linejoin':'round'};let child;
  if(['rect','roundedRect'].includes(p.kind))child=svg('rect',{...attrs,x:1,y:1,width:Math.max(0,w-2),height:Math.max(0,h-2),rx:p.kind==='rect'?0:p.radius});
  else if(p.kind==='ellipse')child=svg('ellipse',{...attrs,cx:w/2,cy:h/2,rx:Math.max(0,w/2-2),ry:Math.max(0,h/2-2)});
  else if(['line','arrow'].includes(p.kind)){child=svg('path',{...attrs,fill:'none',d:`M2 ${h/2} L${w-2} ${h/2}`+(p.kind==='arrow'?` M${w-15} ${h/2-10} L${w-2} ${h/2} L${w-15} ${h/2+10}`:'')});}
  else if(p.kind==='text'){child=svg('text',{x:4,y:h/2,fill:p.fill,'font-size':20});child.textContent=p.text;}
  else child=svg('path',{...attrs,d:path(p,w,h),fill:['path','pencil'].includes(p.kind)?'none':p.fill});g.append(child);return g;
 }
 function chart(n,w,h){const p=n.props,g=svg('g');const text=(value,x,y,size=12)=>{const t=svg('text',{x,y,fill:'#242424','font-size':size});t.textContent=value;g.append(t);};text(p.title,12,22,16);const series=p.series.filter(s=>s.values.length),values=series.flatMap(s=>s.values);if(!values.length){text('Sem dados',w/2-30,h/2);return g;}
  const left=35,top=40,bottom=h-35,plotW=w-50,plotH=h-80,min=Math.min(0,...values),max=Math.max(1,...values),range=max-min,xx=(i,count)=>left+i*plotW/Math.max(1,count-1),yy=value=>bottom-(value-min)/range*plotH;
  if(['pie','donut','progress','gauge'].includes(p.kind)){let data=series[0].values;if(['progress','gauge'].includes(p.kind))data=[Math.min(100,data[0]),100-Math.min(100,data[0])];const total=data.reduce((a,b)=>a+b,0)||1,cx=w/2,cy=h/2+8,r=Math.min(w,h)*.30;let angle=p.kind==='gauge'?Math.PI:-Math.PI/2;const palette=['#167CB8','#FFB347','#B56BC3','#5FAF72','#E96565'];
   for(const [i,value] of data.entries()){const span=value/total*Math.PI*(p.kind==='gauge'?1:2),count=Math.max(2,Math.ceil(span*20));const points=Array.from({length:count},(_,j)=>{const t=angle+span*j/(count-1);return [cx+Math.cos(t)*r,cy+Math.sin(t)*r];});g.append(svg('path',{d:`M${cx} ${cy} L`+points.map(p=>p.join(' ')).join(' L')+' Z',fill:palette[i%palette.length]}));angle+=span;}if(p.kind!=='pie')g.append(svg('circle',{cx,cy,r:r*.62,fill:'white'}));
  }else if(p.kind==='kpi')text(String(values.at(-1)),left,h/2+20,42);
  else{if(p.kind!=='sparkline'){g.append(svg('path',{d:`M${left} ${top} V${bottom} H${w-10}`,stroke:'#999',fill:'none'}));text(String(max),0,top+5);text(String(min),0,bottom);}
   for(const [index,s] of series.entries()){const coords=s.values.map((v,i)=>[xx(i,s.values.length),yy(v)]);
    if(['bar','column'].includes(p.kind))for(const [i,v] of s.values.entries()){const width=plotW/Math.max(1,s.values.length),bar=width/(series.length+1);g.append(svg('rect',{x:left+i*width+index*bar,y:Math.min(yy(v),yy(0)),width:Math.max(1,bar-2),height:Math.max(1,Math.abs(yy(v)-yy(0))),fill:s.color}));}
    else if(p.kind==='scatter')for(const [x,y] of coords)g.append(svg('circle',{cx:x,cy:y,r:4,fill:s.color}));
    else g.append(svg('path',{d:'M'+coords.map(p=>p.join(' ')).join(' L')+(p.kind==='area'?` L${coords.at(-1)[0]} ${bottom} L${left} ${bottom} Z`:''),stroke:s.color,'stroke-width':3,fill:p.kind==='area'?s.color:'none','fill-opacity':.25}));
   }
  }if(p.legend)text(series.map(s=>s.name).join(' · '),12,h-8);return g;
 }
 function render(n,options={}){const w=n.type==='DrawingCanvas'?n.props.viewportWidth:typeof n.layout.width==='number'?n.layout.width:320,h=n.type==='DrawingCanvas'?n.props.viewportHeight:typeof n.layout.height==='number'?n.layout.height:220,e=svg('svg',{viewBox:`0 0 ${w} ${h}`,width:'100%',height:'100%',role:'img','aria-label':n.name,preserveAspectRatio:'none'});
  if(n.type==='Shape')e.append(shape(n,w,h));else if(n.type==='Chart')e.append(chart(n,w,h));else{e.style.background=n.props.background;for(const c of n.children){if(!c.layout.visible)continue;const group=svg('g',{transform:`translate(${c.layout.x} ${c.layout.y})`});group.dataset.graphicNode=c.id;group.append(shape(c,Number(c.layout.width)||120,Number(c.layout.height)||80));group.onclick=ev=>{if(!options.preview){ev.stopPropagation();options.select?.(c.id,ev.ctrlKey);}};e.append(group);}}for(const text of e.querySelectorAll('text'))text.setAttribute('font-size',Number(text.getAttribute('font-size')||16)*(options.fontScale||1));return e;
 }
 return {render,path};
})();
