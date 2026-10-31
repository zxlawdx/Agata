"""Patch scalar call-site expressions only when the exact analyzed source still matches.
Shared definition bodies, structural edits and unmapped properties remain conflicts.
"""
import hashlib,json
from apps.android_designer.domain.model import walk


def literal(prop,value):
    if isinstance(value,bool):return str(value).lower()
    if isinstance(value,str):
        if prop in {'color','background'} and value.startswith('#') and len(value)==7:return 'Color(0xFF'+value[1:]+')'
        if prop in {'text','label','placeholder','value','description'}:return json.dumps(value,ensure_ascii=False).replace('$','\\$')
    if type(value) in (int,float) and prop in {'fontSize','maxLines'}:return str(2147483647 if prop=='maxLines' and value==0 else value)+('.sp' if prop=='fontSize' else '')
    return None


def patch_sources(document,sources):
    patches={};conflicts=[];hashes=document.get('compose_project',{}).get('sources',{})
    all_nodes=[n for s in document['screens'] for n in walk(s['root'])];by_id={n['id']:n for n in all_nodes}
    baseline=document.get('compose_project',{}).get('structure');current=hashlib.sha256(str([(n['id'],[c['id'] for c in n['children']]) for n in all_nodes]).encode()).hexdigest()
    if baseline and baseline!=current:conflicts.append('Estrutura visual alterada: aplicação apenas na cópia gerada; fontes estruturais preservadas.')
    for screen in document['screens']:
        for node in walk(screen['root']):
            meta=node.get('compose',{});base=meta.get('base_props',{})
            if any(b.get('override') for b in meta.get('styles',{}).values()):conflicts.append(node['id']+':estilo de instância (aplicado no projeto gerado; fonte compartilhada preservada)')
            if meta.get('base_layout') and any(node['layout'].get(k)!=v for k,v in meta['base_layout'].items()):conflicts.append(node['id']+':layout (aplicado no projeto gerado; DSL original preservada)')
            for prop,value in node['props'].items():
                if prop not in base or value==base[prop]:continue
                binding=meta.get('styles',{}).get(prop);replacement=literal(prop,value)
                if binding and meta.get('instance_owner'):
                    owner=by_id.get(meta['instance_owner'],{}).get('compose',{});parameter=binding.get('parameter');span=owner.get('instance',{}).get('argument_sources',{}).get(parameter)
                    uses=[b for candidate in all_nodes if candidate.get('compose',{}).get('instance_owner')==meta['instance_owner'] for b in candidate.get('compose',{}).get('styles',{}).values() if b.get('parameter')==parameter] if parameter else []
                    binding={**binding,'source':span,'expression':span['expression']} if span and len(uses)==1 else None
                if not binding or not replacement:
                    conflicts.append(node['id']+':'+prop+' (sem região segura da instância)');continue
                span=binding.get('source',{});path=span.get('path');data=sources.get(path)
                if data is None or hashlib.sha256(data).hexdigest()!=hashes.get(path):conflicts.append(str(path)+' (fonte alterada após análise)');continue
                start,end=span.get('start'),span.get('end')
                if type(start) is not int or type(end) is not int or not 0<=start<end<=len(data):conflicts.append(str(path)+' (intervalo inválido)');continue
                if data[start:end].decode()!=binding['expression']:conflicts.append(str(path)+' (expressão divergente)');continue
                patches.setdefault(path,[]).append((start,end,replacement.encode()))
    output=dict(sources)
    for path,entries in patches.items():
        ordered=sorted(set(entries));overlap=any(ordered[i][1]>ordered[i+1][0] for i in range(len(ordered)-1))
        if overlap:conflicts.append(path+' (alterações sobrepostas)');continue
        data=output[path]
        for start,end,value in reversed(ordered):data=data[:start]+value+data[end:]
        output[path]=data
    return output,conflicts
