"""Native Canvas/Paint source, used by Android Views and Compose AndroidView.
All paths come from validated numeric commands. No bitmap/raster conversion.
"""
import math,json


def q(value):return json.dumps(str(value),ensure_ascii=False).replace('$','\\$')


def f(value):return str(round(float(value),4))+'f'


def native_graphic(generator,node):
    name='AgataGraphic_'+node['id'];w=node['props'].get('viewportWidth',node['layout']['width']);h=node['props'].get('viewportHeight',node['layout']['height']);w=w if isinstance(w,(int,float)) else 320;h=h if isinstance(h,(int,float)) else 220
    lines=[]
    def path(data,color,stroke=0,opacity=1):
        lines.append(f'p.color = android.graphics.Color.parseColor({q(color)}); p.alpha = {round(opacity*255)}; p.style = android.graphics.Paint.Style.{"STROKE" if stroke else "FILL"}; p.strokeWidth = {f(stroke)}; androidx.core.graphics.PathParser.createPathFromPathData({q(data)})?.let {{ canvas.drawPath(it, p) }}')
    def text(value,x,y,size=12,color='#242424',opacity=1):
        lines.append(f'p.color = android.graphics.Color.parseColor({q(color)}); p.alpha={round(opacity*255)}; p.style=android.graphics.Paint.Style.FILL; p.textSize={f(size)} * resources.configuration.fontScale; canvas.drawText({q(value)}, {f(x)}, {f(y)}, p)')
    def shape(n,sw,sh):
        p=n['props'];kind=p['kind'];lines.append(f'canvas.save(); canvas.rotate({f(p["rotation"])}, {f(sw/2)}, {f(sh/2)})')
        if kind=='ellipse':
            k=.55228475;cx=sw/2;cy=sh/2;rx=max(0,cx-2);ry=max(0,cy-2)
            d=f'M {cx+rx} {cy} C {cx+rx} {cy+ry*k} {cx+rx*k} {cy+ry} {cx} {cy+ry} C {cx-rx*k} {cy+ry} {cx-rx} {cy+ry*k} {cx-rx} {cy} C {cx-rx} {cy-ry*k} {cx-rx*k} {cy-ry} {cx} {cy-ry} C {cx+rx*k} {cy-ry} {cx+rx} {cy-ry*k} {cx+rx} {cy} Z'
        elif kind in {'rect','roundedRect'}:
            r=min(p['radius'],sw/2,sh/2) if kind=='roundedRect' else 0
            d=f'M {r} 1 L {sw-r} 1 Q {sw-1} 1 {sw-1} {r} L {sw-1} {sh-r} Q {sw-1} {sh-1} {sw-r} {sh-1} L {r} {sh-1} Q 1 {sh-1} 1 {sh-r} L 1 {r} Q 1 1 {r} 1 Z'
        elif kind in {'line','arrow'}:d=f'M 2 {sh/2} L {sw-2} {sh/2}'+(f' M {sw-15} {sh/2-10} L {sw-2} {sh/2} L {sw-15} {sh/2+10}' if kind=='arrow' else '')
        elif kind in {'path','pencil'}:d=' '.join(' '.join(str(x) for x in c) for c in p['path'])
        elif kind=='text':text(p['text'],4,sh/2,20,p['fill'],p['opacity']);d=''
        else:
            count=3 if kind=='triangle' else 10 if kind=='star' else 6
            pts=[(sw/2+math.cos(i*2*math.pi/count-math.pi/2)*sw*(.22 if kind=='star' and i%2 else .48),sh/2+math.sin(i*2*math.pi/count-math.pi/2)*sh*(.22 if kind=='star' and i%2 else .48)) for i in range(count)]
            d='M '+' L '.join(f'{x} {y}' for x,y in pts)+' Z'
        if d:
            if kind not in {'line','arrow','path','pencil'}:path(d,p['fill'],opacity=p['opacity'])
            if p['strokeWidth']:path(d,p['stroke'],p['strokeWidth'],p['opacity'])
        lines.append('canvas.restore()')
    if node['type']=='Shape':shape(node,w,h)
    elif node['type']=='DrawingCanvas':
        lines.append(f'canvas.drawColor(android.graphics.Color.parseColor({q(node["props"]["background"])}))')
        for child in node['children']:
            l=child['layout']
            if not l['visible']:continue
            lines.append(f'canvas.save(); canvas.translate({f(l["x"])}, {f(l["y"])})');shape(child,l['width'] if isinstance(l['width'],(int,float)) else 120,l['height'] if isinstance(l['height'],(int,float)) else 80);lines.append('canvas.restore()')
    else:
        p=node['props'];series=[s for s in p['series'] if s['values']];values=[v for s in series for v in s['values']];text(p['title'],12,22,16)
        if not values:text('Sem dados',w/2-30,h/2)
        elif p['kind']=='kpi':text(values[-1],35,h/2+20,42)
        elif p['kind'] in {'pie','donut','progress','gauge'}:
            data=series[0]['values'];total=sum(data) or 1;cx=w/2;cy=h/2+8;r=min(w,h)*.30;angle=-math.pi/2;palette=['#167CB8','#FFB347','#B56BC3','#5FAF72','#E96565']
            if p['kind'] in {'progress','gauge'}:data=[min(100,data[0]),100-min(100,data[0])];total=100
            if p['kind']=='gauge':angle=math.pi
            for i,value in enumerate(data):
                span=value/total*(math.pi if p['kind']=='gauge' else 2*math.pi);count=max(2,math.ceil(span*20));pts=[(cx+math.cos(angle+span*j/(count-1))*r,cy+math.sin(angle+span*j/(count-1))*r) for j in range(count)]
                path(f'M {cx} {cy} L '+' L '.join(f'{x} {y}' for x,y in pts)+' Z',palette[i%len(palette)]);angle+=span
            if p['kind']!='pie':
                lines.append(f'p.color=android.graphics.Color.WHITE; p.alpha=255;p.style=android.graphics.Paint.Style.FILL;canvas.drawCircle({f(cx)},{f(cy)},{f(r*.62)},p)')
        else:
            left=35;top=40;bottom=h-35;pw=w-50;ph=h-80;low=min(0,min(values));high=max(1,max(values));span=high-low
            xx=lambda i,count:left+i*pw/max(1,count-1)
            yy=lambda v:bottom-(v-low)/span*ph
            if p['kind']!='sparkline':path(f'M {left} {top} L {left} {bottom} L {w-10} {bottom}','#999999',1);text(high,0,top+5);text(low,0,bottom)
            for index,s in enumerate(series):
                coords=[(xx(i,len(s['values'])),yy(v)) for i,v in enumerate(s['values'])]
                if p['kind'] in {'bar','column'}:
                    width=pw/max(1,len(s['values']));bw=width/(len(series)+1)
                    for i,value in enumerate(s['values']):
                        x=left+i*width+index*bw;y=min(yy(value),yy(0));height=max(1,abs(yy(value)-yy(0)));path(f'M {x} {y} h {max(1,bw-2)} v {height} h {-max(1,bw-2)} Z',s['color'])
                elif p['kind']=='scatter':
                    for x,y in coords:lines.append(f'p.color=android.graphics.Color.parseColor({q(s["color"])});p.style=android.graphics.Paint.Style.FILL;p.alpha=255;canvas.drawCircle({f(x)},{f(y)},4f,p)')
                else:
                    d='M '+' L '.join(f'{x} {y}' for x,y in coords)
                    if p['kind']=='area':path(d+f' L {coords[-1][0]} {bottom} L {left} {bottom} Z',s['color'],opacity=.25)
                    path(d,s['color'],3)
        if p['legend']:text(' · '.join(s['name'] for s in series),12,h-8)
    package=generator.ns+'.graphics'
    generator.files['app/src/main/java/'+package.replace('.','/')+'/'+name+'.kt']=f'''package {package}
class {name} @JvmOverloads constructor(context: android.content.Context, attrs: android.util.AttributeSet? = null) : android.view.View(context, attrs) {{
 private val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
 init {{ contentDescription = {q(node['name'])} }}
 override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {{ setMeasuredDimension(resolveSize(({f(w)} * resources.displayMetrics.density).toInt(), widthMeasureSpec), resolveSize(({f(h)} * resources.displayMetrics.density).toInt(), heightMeasureSpec)) }}
 override fun onDraw(canvas: android.graphics.Canvas) {{
  super.onDraw(canvas);canvas.save();canvas.scale(width / {f(w)}, height / {f(h)})
  {chr(10).join(lines)}
  canvas.restore()
 }}
}}
'''
    return package+'.'+name
