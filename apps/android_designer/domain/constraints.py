"""Constraint graph validation. Supported graph is acyclic, with required links only.
Chains/circular dependencies are explicitly rejected instead of silently approximated.
"""
import copy

ANCHORS={'start':'x','end':'x','top':'y','bottom':'y','baseline':'baseline'}


def validate_container(parent):
    children={n['id']:n for n in parent['children']};graph={key:set() for key in children}
    for n in children.values():
        c=n['layout']['constraints']
        if set(c)-set(ANCHORS):raise ValueError('Âncora de origem inválida.')
        if 'baseline' in c and ('top' in c or 'bottom' in c):raise ValueError('Baseline não pode ser combinada com top/bottom.')
        for anchor,link in c.items():
            if not isinstance(link,dict) or set(link)!={'target','anchor','margin'}:raise ValueError('Link de constraint inválido.')
            if not isinstance(link['target'],str) or not isinstance(link['anchor'],str):raise ValueError('Alvo ou âncora inválidos.')
            target=children.get(link['target'])
            if link['target']!='parent' and (target is None or target is n):raise ValueError('Alvo deve ser pai ou irmão distinto.')
            if ANCHORS[anchor]!=ANCHORS.get(link['anchor']):raise ValueError('Eixos de constraints incompatíveis.')
            if type(link['margin']) not in (int,float) or not 0<=link['margin']<=4096:raise ValueError('Margem inválida.')
            if anchor=='baseline' and link['margin']!=0:raise ValueError('Baseline suporta margem zero nesta versão.')
            if anchor=='baseline' and (n['type']!='TextLabel' or target is None or target['type']!='TextLabel'):raise ValueError('Baseline requer dois TextLabels.')
            if target:
                if target['type']=='Guideline' and ANCHORS[anchor]!=('x' if target['props']['orientation']=='vertical' else 'y'):raise ValueError('Guideline em eixo incompatível.')
                if target['type']=='Barrier' and ANCHORS[anchor]!=('x' if target['props']['direction'] in {'start','end'} else 'y'):raise ValueError('Barrier em eixo incompatível.')
                graph[n['id']].add(target['id'])
        if n['type']=='Barrier':
            refs=n['props']['references'].split()
            if not refs or len(refs)!=len(set(refs)) or any(r not in children or r==n['id'] or children[r]['type'] in {'Guideline','Barrier'} for r in refs):raise ValueError('Referências de Barrier inválidas.')
            graph[n['id']].update(refs)
        if n['type'] in {'Guideline','Barrier'} and c:raise ValueError('Helpers não recebem links; edite suas propriedades.')
    visiting=set();done=set()
    def visit(key):
        if key in visiting:raise ValueError('Ciclo de constraints; chains recíprocas ainda não são suportadas.')
        if key in done:return
        visiting.add(key)
        for other in graph[key]:visit(other)
        visiting.remove(key);done.add(key)
    for key in graph:visit(key)


def validate_layers(screen):
    from .model import walk,ID
    ids={n['id'] for n in walk(screen['root'])};used=set();layer_ids=set()
    layers=screen.get('layers',[])
    if not isinstance(layers,list) or len(layers)>100:raise ValueError('Camadas inválidas.')
    for layer in layers:
        if not isinstance(layer,dict) or set(layer)!={'id','name','nodes','visible','locked','opacity'}:raise ValueError('Estrutura de camada inválida.')
        if not isinstance(layer['id'],str) or not ID.fullmatch(layer['id']) or layer['id'] in layer_ids:raise ValueError('ID de camada inválido.')
        layer_ids.add(layer['id'])
        if not isinstance(layer['name'],str) or not 1<=len(layer['name'])<=80:raise ValueError('Nome de camada inválido.')
        if type(layer['visible']) is not bool or type(layer['locked']) is not bool or type(layer['opacity']) not in (int,float) or not 0<=layer['opacity']<=1:raise ValueError('Estado de camada inválido.')
        if not isinstance(layer['nodes'],list) or any(not isinstance(n,str) or n not in ids or n in used for n in layer['nodes']) or len(layer['nodes'])!=len(set(layer['nodes'])):raise ValueError('Associação de camada inválida.')
        used.update(layer['nodes'])


def layered_screen(screen):
    result=copy.deepcopy(screen)
    from .model import walk
    nodes={n['id']:n for n in walk(result['root'])}
    for order,layer in enumerate(result.get('layers',[])):
        for key in layer['nodes']:
            n=nodes.get(key)
            if n:
                n['layout']['visible'] &= layer['visible'];n['layout']['locked'] |= layer['locked']
                if not layer['visible']:
                    for rule in n['layout']['responsive'].values():rule['visible']=False
                n['_layer']={'order':order+1,'opacity':layer['opacity']}
    return result
