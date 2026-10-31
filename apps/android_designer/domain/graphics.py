"""Structured graphics validation; bounded vector subset, never arbitrary SVG or scripts."""
import math,re
COLOR=re.compile(r'^#[0-9a-fA-F]{6}$')
KINDS={'rect','roundedRect','ellipse','line','arrow','triangle','polygon','star','path','pencil','text'}
CHARTS={'line','bar','column','area','pie','donut','scatter','progress','gauge','sparkline','kpi'}


def numeric(n,low=-1000000,high=1000000):return type(n) in (int,float) and math.isfinite(n) and low<=n<=high


def validate_graphic(n):
    p=n['props']
    if n['type']=='Shape':
        if p['kind'] not in KINDS or not COLOR.fullmatch(p['fill']) or not COLOR.fullmatch(p['stroke']):raise ValueError('Forma/cor inválida.')
        if not numeric(p['opacity'],0,1) or not numeric(p['rotation'],-360,360) or not numeric(p['strokeWidth'],0,100):raise ValueError('Aparência da forma inválida.')
        if not isinstance(p['path'],list) or len(p['path'])>2000:raise ValueError('Path excede o limite.')
        for command in p['path']:
            if not isinstance(command,list) or not command or command[0] not in {'M','L','C','Q','Z'}:raise ValueError('Comando de path inválido.')
            count={'M':2,'L':2,'C':6,'Q':4,'Z':0}[command[0]]
            if len(command)!=count+1 or any(not numeric(x,-4096,4096) for x in command[1:]):raise ValueError('Coordenadas de path inválidas.')
    elif n['type']=='DrawingCanvas':
        if not all(numeric(p[k],1,4096) for k in ('viewportWidth','viewportHeight')) or any(c['type']!='Shape' for c in n['children']):raise ValueError('DrawingCanvas aceita somente formas e viewport válido.')
    elif n['type']=='Chart':
        if p['kind'] not in CHARTS or not isinstance(p['series'],list) or len(p['series'])>12 or not isinstance(p['labels'],list) or len(p['labels'])>500:raise ValueError('Gráfico inválido.')
        if any(not isinstance(x,str) or len(x)>80 for x in p['labels']):raise ValueError('Rótulos inválidos.')
        for series in p['series']:
            if not isinstance(series,dict) or set(series)!={'name','color','values'} or not isinstance(series['name'],str) or len(series['name'])>80 or not COLOR.fullmatch(series['color']):raise ValueError('Série inválida.')
            if not isinstance(series['values'],list) or len(series['values'])>500 or any(not numeric(x) for x in series['values']):raise ValueError('Dados numéricos inválidos.')
            if p['kind'] in {'pie','donut','progress','gauge'} and any(x<0 for x in series['values']):raise ValueError('Este gráfico exige valores não negativos.')
