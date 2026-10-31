"""Versioned UI document. Independent of Fabric, DOM and Android code generators."""
from __future__ import annotations
import copy
import json
import re
from pathlib import Path
from uuid import uuid4

VERSION = 4
REGISTRY = json.loads((Path(__file__).resolve().parents[1]/'static/model/components.json').read_text())
ICONS = {'none','menu','back','home','search','close','settings','plus'}
ID = re.compile(r'^[a-z][a-z0-9_]{0,63}$')
NAMESPACE = re.compile(r'^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$')
COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')
KEYWORDS = {'class','fun','package','object','when','is','in','return','val','var','import','if','else','while','for','null','true','false','interface','this','super','typealias','break','continue','do','throw','try','catch','finally','as','typeof'}


def new_node(kind: str, props=None, role='') -> dict:
    spec=REGISTRY[kind]
    return {'id':'n_'+uuid4().hex,'type':kind,'name':kind,'role':role,
        'props':{**copy.deepcopy(spec['properties']),**(props or {})},
        'layout':copy.deepcopy(spec['layout']),'events':{},'states':{},'export':{},
        'children':[new_node(c['type'],c['props'],c['role']) for c in spec['children']]}


def new_screen(name='Tela Inicial', x=80, y=80):
    root=new_node('Column');root['layout'].update(padding=24,gap=16)
    return {'id':'s_'+uuid4().hex,'name':name,'width':390,'height':844,
            'position':{'x':x,'y':y},'root':root,'layers':[]}


def new_document():
    screen=new_screen()
    return {'version':VERSION,'namespace':'com.example.agata','app_name':'Agata App',
        'start_screen':screen['id'],'screens':[screen], 'theme':{'dynamicColor':True,'darkMode':'system','primary':'#53AFF2'},
        'custom_files':{}}


def walk(node):
    yield node
    for child in node['children']:
        yield from walk(child)


def migrate(document):
    document=copy.deepcopy(document)
    if isinstance(document,dict) and document.get('version')==1:
        for screen in document.get('screens',[]):
            for n in walk(screen['root']):
                defaults=REGISTRY.get(n['type'],{}).get('layout',{})
                n['layout']={**copy.deepcopy(defaults),**n['layout']}
                if n['type']=='TextLabel':n['props']={'maxLines':0,'overflow':'clip',**n['props']}
        document['version']=2
    if isinstance(document,dict) and document.get('version')==2:
        for screen in document.get('screens',[]):
            screen.setdefault('layers',[])
            for n in walk(screen['root']):
                n['layout']={**copy.deepcopy(REGISTRY.get(n['type'],{}).get('layout',{})),**n['layout']}
        document['version']=3
    if isinstance(document,dict) and document.get('version')==3:document['version']=VERSION
    return document


def resolve_layout(layout,width,height):
    result=copy.deepcopy(layout)
    group='compact' if width<600 else 'medium' if width<840 else 'expanded'
    result.update(layout['responsive'].get(group,{}))
    if width>height:result.update(layout['responsive'].get('landscape',{}))
    return result


def resolve_screen(screen,width,height):
    result=copy.deepcopy(screen)
    for n in walk(result['root']):n['layout']=resolve_layout(n['layout'],width,height)
    return result


def validate(document):
    """Reject unsupported semantics rather than silently discarding them in exports."""
    document=migrate(document)
    if not isinstance(document,dict) or document.get('version')!=VERSION:
        raise ValueError('Versão de modelo Android não suportada.')
    if len(json.dumps(document,allow_nan=False).encode())>8_000_000:
        raise ValueError('Modelo excede 8 MB.')
    if 'android_settings' in document:
        from apps.workspace.services.settings import validate_settings
        document['android_settings']=validate_settings(document['android_settings'])
    ns=document.get('namespace','')
    if not isinstance(ns,str) or not NAMESPACE.fullmatch(ns) or any(p in KEYWORDS for p in ns.split('.')):
        raise ValueError('Namespace Android inválido.')
    if not isinstance(document.get('app_name'),str) or not 1<=len(document['app_name'])<=80:
        raise ValueError('Nome do aplicativo inválido.')
    screens=document.get('screens')
    if not isinstance(screens,list) or not (0 if document.get('import_empty') is True else 1)<=len(screens)<=40:
        raise ValueError('Use entre 1 e 40 Screens.')
    ids=set();screen_ids=set()
    def number(value,low,high):
        return type(value) in (int,float) and low<=value<=high
    def register(value):
        if not isinstance(value,str) or not ID.fullmatch(value) or value in ids:
            raise ValueError('ID inválido ou duplicado.')
        ids.add(value)
    for screen in screens:
        register(screen.get('id'));screen_ids.add(screen['id'])
        if not isinstance(screen.get('name'),str) or not 1<=len(screen['name'])<=80:
            raise ValueError('Nome de Screen inválido.')
        if any(not number(screen.get(k),240,4096) for k in ('width','height')):
            raise ValueError('Dimensões de Screen inválidas.')
        if any(not number(screen.get('position',{}).get(k),0,1_000_000) for k in ('x','y')):
            raise ValueError('Posição de workspace inválida.')
    count=0
    def node(n,depth=0,parent=None):
        nonlocal count
        count+=1
        if depth>24 or count>3000 or not isinstance(n,dict):
            raise ValueError('Árvore de componentes muito grande.')
        register(n.get('id'))
        spec=REGISTRY.get(n.get('type'))
        if spec is None:raise ValueError('Tipo de componente não suportado.')
        if not isinstance(n.get('name'),str) or len(n['name'])>100:raise ValueError('Nome de componente inválido.')
        props=n.get('props');layout=n.get('layout');events=n.get('events')
        if not isinstance(props,dict) or set(props)!=set(spec['properties']):raise ValueError('Propriedades incompatíveis com o registro.')
        for key,default in spec['properties'].items():
            value=props[key]
            if isinstance(default,(list,dict)):valid=isinstance(value,type(default))
            elif isinstance(default,bool):valid=type(value) is bool
            elif isinstance(default,(int,float)):valid=number(value,-100000,100000)
            else:valid=isinstance(value,str) and len(value)<=(3_000_000 if key=='source' else 500000)
            if not valid:raise ValueError('Valor inválido: '+key)
            if key in {'background','color'} and not COLOR.fullmatch(value):raise ValueError('Cor inválida.')
        for key in ('radius','elevation','fontSize'):
            if key in props and not number(props[key],1 if key=='fontSize' else 0,1000):raise ValueError('Estilo numérico inválido.')
        if props.get('icon','none') not in ICONS:raise ValueError('Ícone inválido.')
        if props.get('variant','filled') not in {'filled','outlined','text','tonal','elevated'}:raise ValueError('Variante inválida.')
        if props.get('keyboard','text') not in {'text','email','number','password','phone'}:raise ValueError('Teclado inválido.')
        if props.get('align','start') not in {'start','center','end'}:raise ValueError('Alinhamento de texto inválido.')
        if n['type']=='ProgressIndicator' and not number(props['value'],0,1):raise ValueError('Progresso deve estar entre 0 e 1.')
        if n['type']=='Slider' and not (props['min']<props['max'] and props['min']<=props['value']<=props['max']):raise ValueError('Limites do Slider inválidos.')
        if not isinstance(layout,dict) or set(layout)!=set(spec['layout']):raise ValueError('Layout inválido.')
        for key in ('width','height'):
            if layout[key] not in ('fill','wrap') and not number(layout[key],1,4096):raise ValueError('Tamanho inválido.')
        for key in ('padding','gap','weight'):
            if not number(layout[key],0,1000):raise ValueError('Layout numérico inválido.')
        if layout['alignment'] not in {'start','center','end'} or layout['arrangement'] not in {'start','center','end','spaceBetween'} or layout['scroll'] not in {'none','vertical','horizontal'}:raise ValueError('Regra de layout inválida.')
        for key in ('x','y','minWidth','maxWidth','minHeight','maxHeight','margin'):
            if not number(layout[key],0,4096):raise ValueError('Restrição numérica inválida: '+key)
        for minimum,maximum in [('minWidth','maxWidth'),('minHeight','maxHeight')]:
            if layout[minimum]>layout[maximum]:raise ValueError('Limites de tamanho conflitantes.')
        for axis in ('width','height'):
            title=axis.title()
            if number(layout[axis],1,4096) and not layout['min'+title]<=layout[axis]<=layout['max'+title]:raise ValueError('Tamanho fixo incompatível com os limites.')
        if not number(layout['aspectRatio'],0,100):raise ValueError('Aspect ratio inválido.')
        if layout['aspectRatio'] and (layout['minWidth']>layout['maxHeight']*layout['aspectRatio'] or layout['minHeight']*layout['aspectRatio']>layout['maxWidth']):raise ValueError('Aspect ratio incompatível com os limites.')
        if type(layout['columns']) is not int or not 1<=layout['columns']<=12:raise ValueError('Use 1–12 colunas.')
        if layout['mode'] not in {'auto','free','constraint'} or layout['mode']=='free' and n['type']!='Box':raise ValueError('Posicionamento livre requer Box.')
        if layout['anchorX'] not in {'start','center','end','fill'} or layout['anchorY'] not in {'top','center','bottom','fill'}:raise ValueError('Âncora inválida.')
        for key in ('wrap','visible','locked'):
            if type(layout[key]) is not bool:raise ValueError('Estado de layout inválido.')
        if layout['mode']=='constraint' and n['type']!='ConstraintLayout':raise ValueError('Modo constraint requer ConstraintLayout.')
        for bias in ('horizontalBias','verticalBias'):
            if not number(layout[bias],0,1):raise ValueError('Bias deve estar entre 0 e 1.')
        if not isinstance(layout['constraints'],dict):raise ValueError('Constraints inválidas.')
        if layout['constraints'] and (parent is None or parent['type']!='ConstraintLayout'):raise ValueError('Constraints requerem pai ConstraintLayout.')
        if n['type']=='RecyclerView' and (props['orientation'] not in {'vertical','horizontal'} or props['layoutManager'] not in {'linear','grid','staggered'}):raise ValueError('Layout de RecyclerView inválido.')
        if n['type']=='Region' and props['orientation'] not in {'horizontal','vertical'}:raise ValueError('Orientação de região inválida.')
        if n['type']=='Guideline' and (props['orientation'] not in {'vertical','horizontal'} or not number(props['percent'],0,1)):raise ValueError('Guideline inválida.')
        if n['type']=='Barrier' and (props['direction'] not in {'start','end','top','bottom'} or not number(props['barrierMargin'],0,4096)):raise ValueError('Barrier inválida.')
        if n['type'] in {'Guideline','Barrier'} and (parent is None or parent['type']!='ConstraintLayout'):raise ValueError('Helper requer ConstraintLayout.')
        overrides=layout['responsive']
        if not isinstance(overrides,dict) or set(overrides)-{'compact','medium','expanded','landscape'}:raise ValueError('Classe de janela inválida.')
        for rule in overrides.values():
            if not isinstance(rule,dict) or set(rule)-{'width','height','minWidth','maxWidth','minHeight','maxHeight','padding','gap','weight','columns','alignment','arrangement','visible','wrap'}:raise ValueError('Override responsivo inválido.')
            resolved={**layout,**rule,'responsive':{}}
            if any(not number(resolved[k],0,4096) for k in ('minWidth','maxWidth','minHeight','maxHeight','padding','gap','weight')):raise ValueError('Restrição responsiva inválida.')
            if resolved['minWidth']>resolved['maxWidth'] or resolved['minHeight']>resolved['maxHeight']:raise ValueError('Limites responsivos conflitantes.')
            for axis in ('width','height'):
                if resolved[axis] not in ('fill','wrap') and not number(resolved[axis],1,4096):raise ValueError('Dimensão responsiva inválida.')
            if type(resolved['visible']) is not bool or type(resolved['wrap']) is not bool or type(resolved['columns']) is not int or not 1<=resolved['columns']<=12:raise ValueError('Override de estado inválido.')
            if resolved['alignment'] not in {'start','center','end'} or resolved['arrangement'] not in {'start','center','end','spaceBetween'}:raise ValueError('Alinhamento responsivo inválido.')
        if n['type']=='TextLabel':
            if type(props['maxLines']) is not int or not 0<=props['maxLines']<=1000 or props['overflow'] not in {'clip','ellipsis'}:raise ValueError('Regra de texto inválida.')
        if layout['weight'] and (parent is None or parent['type'] not in {'Row','Column'} or parent['layout']['scroll']!='none'):
            raise ValueError('Peso requer Row/Column sem scroll: '+n['id']+' ('+n['name']+'), weight='+str(layout['weight'])+', pai='+(parent['type'] if parent else 'raiz'))
        if not isinstance(events,dict) or set(events)-{'onClick'}:raise ValueError('Evento não suportado.')
        if events:
            from .events import validate_event
            validate_event(events['onClick'],screen_ids)
        if n['type'] in {'Shape','DrawingCanvas','Chart'}:
            from .graphics import validate_graphic
            validate_graphic(n)
        from .compose import validate_compose
        validate_compose(n)
        children=n.get('children')
        if not isinstance(children,list) or children and not spec['container']:raise ValueError('Este componente não aceita filhos.')
        for c in children:node(c,depth+1,n)
    from apps.android_designer.domain.constraints import validate_container, validate_layers
    for screen in screens:
        node(screen.get('root'))
        for n in walk(screen['root']):
            if n['type']=='ConstraintLayout':validate_container(n)
        validate_layers(screen)
        fields={n['id'] for n in walk(screen['root']) if n['type']=='TextField'}
        for n in walk(screen['root']):
            if any(rule['field'] not in fields for rule in n['events'].get('onClick',{}).get('validation',[])):raise ValueError('Campo de validação inexistente na Screen.')

    if screens and document.get('start_screen') not in screen_ids:raise ValueError('Screen inicial inexistente.')
    theme=document.get('theme',{})
    if type(theme.get('dynamicColor')) is not bool or theme.get('darkMode') not in {'system','light','dark'} or not COLOR.fullmatch(theme.get('primary','')):raise ValueError('Tema inválido.')
    viewport=document.get('viewport')
    if viewport is not None and (not isinstance(viewport,dict) or not number(viewport.get('zoom'),.15,2.5) or any(not number(viewport.get(k),0,2_500_000) for k in ('x','y'))):raise ValueError('Viewport inválida.')
    files=document.get('custom_files')
    if not isinstance(files,dict):raise ValueError('Arquivos personalizados inválidos.')
    for path,content in files.items():
        if not re.fullmatch(r'(compose|xml)/app/src/main/(java/[a-zA-Z0-9_/]+\.kt|res/(layout|values)/[a-z0-9_]+\.xml)',path) or not isinstance(content,str) or len(content)>500000:
            raise ValueError('Caminho ou conteúdo de código personalizado inválido.')
        if path.endswith('.xml'):
            from xml.etree import ElementTree
            try:ElementTree.fromstring(content)
            except ElementTree.ParseError as exc:raise ValueError('XML personalizado inválido: '+path+' — '+str(exc)) from exc
    return copy.deepcopy(document)
