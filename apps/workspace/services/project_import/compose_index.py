"""Project-wide syntax index. No Kotlin evaluation, reflection or dependency loading."""
from dataclasses import dataclass
from hashlib import sha256


def nodes(node,kind=None):
    if kind is None or node.type==kind:yield node
    for child in node.named_children:yield from nodes(child,kind)

@dataclass
class Unit:
    path:str
    source:bytes
    tree:object
    package:str
    imports:dict
    def text(self,node):return self.source[node.start_byte:node.end_byte].decode()

@dataclass
class Function:
    key:str
    name:str
    unit:Unit
    node:object
    body:object
    parameters:list

class ComposeIndex:
    def __init__(self,files,parser):
        self.units={};self.functions={};self.symbols={};self.ambiguous=[];self.private_symbols=set()
        for path,text in sorted(files.items()):
            if not path.endswith('.kt'):continue
            source=text.encode();tree=parser.parse(source);get=lambda n:source[n.start_byte:n.end_byte].decode()
            package=next(nodes(tree.root_node,'package_header'),None);package=get(package).removeprefix('package ').strip() if package else ''
            imports={}
            for item in nodes(tree.root_node,'import'):
                raw=get(item).removeprefix('import ').strip().split(' as ');imports[raw[-1] if len(raw)>1 else raw[0].split('.')[-1]]=raw[0]
            unit=Unit(path,source,tree,package,imports);self.units[path]=unit
            for child in tree.root_node.named_children:
                if child.type=='property_declaration':
                    variable=next(nodes(child,'variable_declaration'),None)
                    if variable and child.named_children[-1] is not variable:self.symbols[(path,get(variable))]=child.named_children[-1]
                    if get(child).lstrip().startswith('private ') and variable:self.private_symbols.add((path,get(variable)))
            for obj in [c for c in tree.root_node.named_children if c.type=='object_declaration']:
                owner=next((get(c) for c in obj.named_children if c.type=='identifier'),'')
                body=next((c for c in obj.named_children if c.type=='class_body'),None)
                if body:
                    for child in body.named_children:
                        if child.type!='property_declaration':continue
                        variable=next(nodes(child,'variable_declaration'),None)
                        if variable:self.symbols[(path,owner+'.'+get(variable))]=child.named_children[-1]
            for fn in nodes(tree.root_node,'function_declaration'):
                mods=next((c for c in fn.named_children if c.type=='modifiers'),None)
                if mods is None or not any(get(x).split('.')[-1]=='Composable' for x in nodes(mods,'user_type')):continue
                name=next((get(c) for c in fn.named_children if c.type=='identifier'),'')
                if not name or name.endswith('Preview') or any(get(x).split('.')[-1]=='Preview' for x in nodes(mods,'user_type')):continue
                body=next((c for c in fn.named_children if c.type=='function_body'),None)
                params=next((c for c in fn.named_children if c.type=='function_value_parameters'),None)
                parameters=[]
                if params:
                    children=params.named_children
                    for i,c in enumerate(children):
                        if c.type=='parameter':
                            ident=next((x for x in c.named_children if x.type=='identifier'),None)
                            # Defaults are siblings of parameter nodes in tree-sitter-kotlin.
                            default=children[i+1] if i+1<len(children) and children[i+1].type not in {'parameter','parameter_modifiers'} else None
                            if ident:parameters.append((get(ident),default))
                if body:
                    key=sha256((path+':'+name+':'+str(len(parameters))).encode()).hexdigest()[:24];self.functions[key]=Function(key,name,unit,fn,body,parameters)
    def resolve(self,name,unit):
        qualified=unit.imports.get(name,name);short=qualified.split('.')[-1]
        candidates=[f for f in self.functions.values() if (f.unit.path==unit.path or not any('private' in f.unit.text(c).split() for c in f.node.named_children if c.type=='modifiers')) and f.name==short and ('.' not in qualified or f.unit.package+'.'+f.name==qualified)]
        local=[f for f in candidates if f.unit.path==unit.path];same=[f for f in candidates if f.unit.package==unit.package]
        candidates=local or same or candidates
        return candidates[0] if len(candidates)==1 else None
    def symbol(self,name,unit):
        if (unit.path,name) in self.symbols:return unit,self.symbols[(unit.path,name)]
        parts=name.split('.');full=unit.imports.get(parts[0],parts[0])+('.'+'.'.join(parts[1:]) if len(parts)>1 else '');short=full.split('.')[-1]
        candidates=[(self.units[p],v) for (p,n),v in self.symbols.items() if (p==unit.path or (p,n) not in self.private_symbols) and (n==name and self.units[p].package==unit.package or self.units[p].package+'.'+n==full or unit.imports.get('*')==self.units[p].package+'.*' and n==name)]
        return candidates[0] if len(candidates)==1 else None
    def graph(self,call):
        edges={k:set() for k in self.functions};destinations={};entries=set()
        for f in self.functions.values():
            for c in nodes(f.body,'call_expression'):
                target=self.resolve(call(c,f.unit)[0],f.unit)
                if target:edges[f.key].add(target.key)
        for unit in self.units.values():
            for c in nodes(unit.tree.root_node,'call_expression'):
                name,args,pos=call(c,unit)
                if name in {'composable','dialog'}:
                    route=args.get('route') or (pos[0] if pos else None)
                    route=unit.text(route).strip('"') if route and route.type=='string_literal' else None
                    for block in c.named_children:
                        if block.type not in {'annotated_lambda','lambda_literal'}:continue
                        for inner in nodes(block,'call_expression'):
                            target=self.resolve(call(inner,unit)[0],unit)
                            if target:destinations[target.key]=route
                if name=='setContent':
                    for inner in nodes(c,'call_expression'):
                        target=self.resolve(call(inner,unit)[0],unit)
                        if target:entries.add(target.key)
        called=set().union(*edges.values()) if edges else set()
        roots=set(destinations) or (entries if entries else set(edges)-called)
        return edges,destinations,roots
