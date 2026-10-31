"""Optional Compose provenance/presentation on the existing semantic tree."""
import copy,re,hashlib
from .compose_index import ComposeIndex,nodes
from .compose_values import Values
from .compose_modifiers import parse_chain
from apps.android_designer.domain.model import new_node,new_document,new_screen,walk,validate

class Fidelity:
    def action_value(self,expression):
        raw=self.text(expression)
        if raw in self.slots:
            original,unit,scope=self.slots[raw];oldunit,oldscope=self.unit,self.scope;self.use(unit);self.scope=scope
            try:return self.action_value(original)
            finally:self.use(oldunit);self.scope=oldscope
        for call in nodes(expression,'call_expression'):
            name,args,pos=self.call(call);values=[self.literal(v) for v in pos]
            if name=='onAction' and len(values)==2 and values[0] in {'back','navigate','replace'} and isinstance(values[1],str):return {'action':'back'} if values[0]=='back' else {'action':'navigate','target':values[1],**({'policy':'replace'} if values[0]=='replace' else {})}
            if name=='navigate' and len(values)==1 and isinstance(values[0],str):return {'action':'navigate','target':values[0]}
        return None
    def location(self,node):return {'path':self.path,'start':node.start_byte,'end':node.end_byte,'line':node.start_point.row+1,'function':getattr(self,'function_name','')}
    def use(self,unit):self.unit=unit;self.path=unit.path;self.source=unit.source
    def bind(self,n,key,expr,value=None,status=None,prop=None):
        values={mode:self.values.resolve(expr,self.unit,self.scope,mode) for mode in ('light','dark')}
        value=values.get(self.mode) if value is None else value
        def complete(v):return v is not None and (all(complete(x) for k,x in v.items() if k!='constructor') if isinstance(v,dict) else all(complete(x) for x in v) if isinstance(v,list) else True)
        status=status or ('Fully supported' if complete(value) else 'Partially supported' if value is not None else 'Dynamic')
        if value is None:self.warn(expr,'Valor dinâmico/não resolvido de '+key+' preservado na fonte.')
        binding={'expression':self.text(expr),'source':self.location(expr),'value':value,'by_mode':values,'status':status,'property':prop or key}
        if self.text(expr) in getattr(self,'active_parameters',set()) and not (isinstance(self.scope.get(self.text(expr)),dict) and '__expression__' in self.scope[self.text(expr)]):binding['parameter']=self.text(expr)
        symbol=self.index.symbol(self.text(expr),self.unit)
        if symbol:binding['resolution_source']={'path':symbol[0].path,'line':symbol[1].start_point.row+1,'start':symbol[1].start_byte,'end':symbol[1].end_byte,'expression':symbol[0].text(symbol[1])}
        n['compose']['styles'][key]=binding
        target=prop or key
        if target in {'color','background'} and isinstance(value,str) and len(value)==9:value=value[-6:];value='#'+value
        if target in n['props'] and value is not None:
            default=n['props'][target]
            if type(value)==type(default) or type(value) in (int,float) and type(default) in (int,float):n['props'][target]=value
        return value
    def style(self,n,name,args):
        n.setdefault('compose',{'styles':{},'modifiers':[]});meta=n['compose'];meta['source']=self.location(self.ast[n['id']]);meta['arguments']={k:self.text(v) for k,v in args.items()}
        if name=='MaterialTheme' and 'colorScheme' in args:
            selected={mode:self.values.resolve(args['colorScheme'],self.unit,self.scope,mode) for mode in ('light','dark')}
            self.values.themes={mode:value for mode,value in selected.items() if isinstance(value,dict)}
            meta['theme_scope']=selected
        for key in ('text','label','placeholder','value','enabled','checked','selected'):
            if key in args and key in n['props']:self.bind(n,key,args[key])
        for key,prop in {'color':'color' if n['type'] in {'TextLabel','Icon'} else 'background','containerColor':'background','backgroundColor':'background','fontSize':'fontSize','maxLines':'maxLines','lineHeight':'lineHeight','letterSpacing':'letterSpacing','fontFamily':'fontFamily','fontStyle':'fontStyle','fontPadding':'fontPadding','includeFontPadding':'fontPadding','softWrap':'softWrap','textDecoration':'textDecoration','tonalElevation':'tonalElevation','shadowElevation':'elevation','contentColor':'contentColor'}.items():
            if key in args:self.bind(n,prop,args[key],prop=prop)
        if 'fontWeight' in args:
            weight=self.literal(args['fontWeight']);self.bind(n,'fontWeight',args['fontWeight'],weight)
            if weight is not None:n['props']['bold']=weight in {'FontWeight.Bold','FontWeight.ExtraBold','FontWeight.Black'}
        if 'textAlign' in args:
            value=self.literal(args['textAlign']);mapping={'TextAlign.Center':'center','TextAlign.End':'end','TextAlign.Right':'end','TextAlign.Start':'start','TextAlign.Left':'start'}
            if value in mapping:n['props']['align']=mapping[value]
            self.bind(n,'textAlign',args['textAlign'])
        if 'overflow' in args:
            value=self.literal(args['overflow'])
            if value in {'TextOverflow.Ellipsis','TextOverflow.Clip'}:n['props']['overflow']='ellipsis' if value.endswith('Ellipsis') else 'clip'
        if 'style' in args:
            style=self.literal(args['style']);self.bind(n,'textStyle',args['style'],style)
            if isinstance(style,dict):
                for key,value in style.items():
                    if key not in args and key!='constructor':
                        if key in n['props'] and value is not None:n['props'][key]=value
                        meta['styles'].setdefault(key,{'expression':self.text(args['style'])+'.'+key,'value':value,'by_mode':{m:(self.values.resolve(args['style'],self.unit,self.scope,m) or {}).get(key) for m in ('light','dark')},'status':'Fully supported' if value is not None else 'Dynamic','source':self.location(args['style']),'property':key})
        if n['type']=='TextField':
            for label in ('label','placeholder'):
                if label in args:
                    for nested in nodes(args[label],'call_expression'):
                        method,na,np=self.call(nested)
                        if method=='Text':
                            value=self.literal(na.get('text') or (np[0] if np else None))
                            if isinstance(value,str):
                                target=na.get('text') or np[0];self.bind(n,label,target,value)
            if 'keyboardOptions' in args:
                method,ka,kp=self.call(args['keyboardOptions']);kind=self.text(ka['keyboardType']).split('.')[-1] if 'keyboardType' in ka else ''
                if kind in {'Text','Email','Number','Password','Phone'}:n['props']['keyboard']=kind.lower()
        if 'shape' in args:
            shape=self.literal(args['shape']);self.bind(n,'shape',args['shape'],shape)
            if isinstance(shape,dict) and isinstance(shape.get('radius'),(int,float)):
                meta['styles']['radius']={**meta['styles']['shape'],'value':shape['radius']}
                if 'radius' in n['props']:n['props']['radius']=shape['radius']
        if 'colors' in args:
            _,color_arguments,_=self.call(args['colors']) if args['colors'].type=='call_expression' else ('',{},[])
            colors=self.literal(args['colors']);self.bind(n,'materialColors',args['colors'],colors)
            if isinstance(colors,dict):
                for key,value in colors.items():
                    if key=='constructor':continue
                    meta['styles'][key]={'expression':self.text(args['colors'])+'.'+key,'value':value,'by_mode':{m:(self.values.resolve(args['colors'],self.unit,self.scope,m) or {}).get(key) for m in ('light','dark')},'status':'Fully supported' if value is not None else 'Dynamic','source':self.location(args['colors']),'property':key}
                if colors.get('containerColor') and 'background' in n['props']:n['props']['background']=colors['containerColor']
                for role,expression in color_arguments.items():
                    if role=='containerColor' and 'background' in n['props']:self.bind(n,'background',expression)
                    elif role.endswith('Color'):self.bind(n,role,expression)
        for key in ('verticalArrangement','horizontalArrangement'):
            if key not in args:continue
            value=args[key];method,ma,mp=self.call(value);raw=self.text(value)
            if method=='spacedBy' and mp:
                gap=self.literal(mp[0])
                if isinstance(gap,(int,float)):n['layout']['gap']=gap
            else:
                arrangement={'Center':'center','End':'end','Bottom':'end','SpaceBetween':'spaceBetween','Start':'start','Top':'start'}.get(raw.split('.')[-1])
                if arrangement:n['layout']['arrangement']=arrangement
            self.bind(n,key,value)
        for key in ('horizontalAlignment','verticalAlignment','contentAlignment'):
            if key in args:
                raw=self.text(args[key]);value='center' if 'Center' in raw else 'end' if 'End' in raw or 'Bottom' in raw else 'start';n['layout']['alignment']=value;self.bind(n,key,args[key],raw)
        if 'modifier' in args:
            meta['modifiers']=parse_chain(self,args['modifier'])
            event=self.action_value(args['modifier'])
            if event:n['events']={'onClick':event}
            for op in meta['modifiers']:
                method=op['type'];a=op['named'];pos=op['values'];value=pos[0] if pos else None
                if method=='background':
                    source=op['named_sources'].get('color') or (op['positional_sources'][0] if op['positional_sources'] else op['source']);background=a.get('color',value)
                    meta['styles']['background']={'value':background,'by_mode':{m:background for m in ('light','dark')},'status':'Partially supported' if isinstance(background,dict) else 'Fully supported' if background is not None else 'Dynamic','source':source,'expression':source.get('expression',op['expression']),'property':'modifierBackground','from_modifier':True}
                if method=='background':
                    shape=a.get('shape') or (pos[1] if len(pos)>1 else None)
                    if isinstance(shape,dict) and type(shape.get('radius')) in (int,float):
                        key='modifierRadius' if 'radius' in n['props'] else 'radius';meta['styles'][key]={'value':shape['radius'],'by_mode':{m:shape['radius'] for m in ('light','dark')},'status':'Fully supported','source':op['source'],'expression':op['expression'],'property':'modifierRadius','from_modifier':True}
                if method in {'fillMaxWidth','fillMaxSize'}:n['layout']['width']='fill'
                if method in {'fillMaxHeight','fillMaxSize'}:n['layout']['height']='fill'
                if method=='weight' and type(value) in (int,float):n['layout']['weight']=value
                if method in {'widthIn','heightIn'}:
                    axis='Width' if method=='widthIn' else 'Height'
                    for key in ('min','max'):
                        if type(a.get(key)) in (int,float):n['layout'][key+axis]=a[key]
                if method in {'verticalScroll','horizontalScroll'}:n['layout']['scroll']='vertical' if method=='verticalScroll' else 'horizontal'

        # Explicit component colors > local content color > selected known theme role.
        inherited=self.scope.get('LocalContentColor.current')
        if n['type']=='TextLabel' and 'color' not in args and not (isinstance(self.literal(args.get('style')),dict) and self.literal(args['style']).get('color')):
            role='onSurface';value=inherited or self.values.themes.get(self.mode,{}).get(role)
            if value:
                n['props']['color']=value;meta['styles']['color']={'expression':'LocalContentColor.current' if inherited else 'MaterialTheme.colorScheme.'+role,'value':value,'by_mode':{m:inherited or self.values.themes.get(m,{}).get(role) for m in ('light','dark')},'status':'Partially supported','property':'color','source':meta['source'],'note':'Conteúdo herdado/tema estático; defaults nativos dependem da versão Material.'}
        if name=='MaterialTheme':meta['theme_scope']=True
        content=meta['styles'].get('contentColor',{}).get('value') or meta['styles'].get('materialColors',{}).get('value') or {}
        content=content.get('contentColor') if isinstance(content,dict) else content
        return content
    def finish(self,n):
        meta=n.get('compose')
        if not meta:return n
        meta['base_props']=copy.deepcopy(n['props']);meta['base_layout']=copy.deepcopy(n['layout'])
        meta['source_sha256']=hashlib.sha256(self.files[self.path].encode()).hexdigest()
        return n
    def instance(self,function,args,pos,call,key):
        from .compose import stable
        n=new_node('Box');n['id']=stable('n',self.path+':'+key);n['name']=function.name;n['children']=[];n['layout'].update(width='wrap',padding=0,gap=0)
        n['compose']={'source':self.location(call),'styles':{},'modifiers':[],'instance':{'definition':function.key,'arguments':{k:self.text(v) for k,v in args.items()}}}
        if function.key in self.expanding or len(self.expanding)>16:
            n['compose']['placeholder']='Custom Composable — recursive preview unavailable';self.warn(call,'Recursão de Composable preservada sem expansão.');return n
        parent_unit=self.unit;parent_scope=self.scope;parent_name=self.function_name
        scope={}
        call_slots={};argument_sources={};oldparameters=getattr(self,'active_parameters',set())
        for i,(name,default) in enumerate(function.parameters):
            value=args.get(name) or (pos[i] if i<len(pos) else None)
            if value is not None:
                scope[name]=self.literal(value);argument_sources[name]={'expression':self.text(value),**self.location(value)}
                if self.text(value).startswith(('Modifier','modifier')):
                    scope[name]={'modifier_chain':parse_chain(self,value)}
                if value.type in {'lambda_literal','annotated_lambda'}:call_slots[name]=(value,parent_unit,parent_scope)
            elif default is not None:scope[name]=self.values.resolve(default,function.unit,scope,self.mode)
        content=next((c for c in call.named_children if c.type in {'annotated_lambda','lambda_literal'}),None)
        slot=next((name for name,_ in reversed(function.parameters) if name in {'content','body'}),None)
        n['compose']['instance']['argument_sources']=argument_sources
        self.active_parameters={name for name,_ in function.parameters}
        oldslots=self.slots.copy();self.slots.update(call_slots)
        if content and slot:self.slots[slot]=(content,parent_unit,parent_scope)
        self.expanding.append(function.key);self.use(function.unit);self.scope={**parent_scope,**scope};self.function_name=function.name
        try:
            for i,child in enumerate(self.body_calls(function.body)):
                mapped=self.map_node(child,n['id']+'/'+str(i))
                if mapped:
                    modifier=scope.get('modifier',{})
                    if isinstance(modifier,dict) and any(op['type'] in {'weight','fillMaxWidth','fillMaxSize'} for op in modifier.get('modifier_chain',[])):
                        mapped['layout']['width']='fill'
                        mapped.setdefault('compose',{})['instance_fill']=True
                        if 'base_layout' in mapped['compose']:mapped['compose']['base_layout']['width']='fill'
                    for nested in walk(mapped):nested.setdefault('compose',{})['instance_owner']=n['id']
                    n['children'].append(mapped)
        finally:self.use(parent_unit);self.scope=parent_scope;self.function_name=parent_name;self.expanding.pop();self.slots=oldslots;self.active_parameters=oldparameters
        modifier=scope.get('modifier',{})
        for op in modifier.get('modifier_chain',[]) if isinstance(modifier,dict) else []:
            if op['type']=='weight' and op['values']:n['layout']['weight']=op['values'][0]
            if op['type'] in {'fillMaxWidth','fillMaxSize'}:n['layout']['width']='fill'
        if any(c['layout']['width']=='fill' for c in n['children']):n['layout']['width']='fill'
        self.counts['partially_editable']+=1;n['import_compatibility']='Partially Editable';return self.finish(n)
    def conditional(self,node,key):
        from .compose import stable
        children=node.named_children;condition=children[0] if children else node
        raw=self.text(condition);alias=self.scope.get(raw);raw=alias['condition'] if isinstance(alias,dict) and 'condition' in alias else raw;match=re.fullmatch(r'(maxWidth|maxHeight)\s*(>=|<=|>|<|==)\s*(\d+(?:\.\d+)?)\.dp',raw)
        rule={'axis':'width' if match and match[1]=='maxWidth' else 'height','operator':match[2],'value':float(match[3])} if match else None
        n=new_node('Box');n['id']=stable('n',self.path+':'+key);n['name']='Responsive branch';n['layout'].update(padding=0,gap=0,width='wrap');n['children']=[];n['compose']={'styles':{},'modifiers':[],'source':self.location(node),'conditional':{'expression':raw,'rule':rule}}
        if rule is None:
            n['compose']['placeholder']='Dynamic layout — preview context unavailable';self.warn(node,'Condição dinâmica preservada, sem exibir ramos simultaneamente.');return n
        for i,branch in enumerate(children[1:3]):
            b=new_node('Box');b['id']=stable('n',n['id']+'/'+str(i));b['name']='Then' if i==0 else 'Else';b['compose']={'styles':{},'modifiers':[],'branch':True};b['layout'].update(padding=0,gap=0);b['children']=[]
            for j,call in enumerate(self.body_calls(branch)):
                mapped=self.map_node(call,key+'/branch'+str(i)+'/'+str(j))
                if mapped:b['children'].append(mapped)
            n['children'].append(b)
        return n
    def parse_project(self):
        from .compose import stable
        self.index=ComposeIndex(self.files,self.parser);self.scope={};self.mode='dark';self.expanding=[];self.slots={};self.function_name=''
        def indexed_call(node,unit):
            oldpath,oldsource=self.path,self.source;self.path=unit.path;self.source=unit.source
            try:return self.call(node)
            finally:self.path=oldpath;self.source=oldsource
        self.values=Values(self.index,indexed_call,self.resources);schemes=self.values.discover()
        if 'dark' not in self.values.themes:self.mode='light'
        edges,destinations,roots=self.index.graph(indexed_call);doc=new_document();doc.update(screens=[],start_screen='',import_empty=True)
        doc['theme']['darkMode']=self.mode
        if self.values.themes.get(self.mode,{}).get('primary'):doc['theme']['primary']=self.values.themes[self.mode]['primary']
        doc['theme']['dynamicColor']=False
        project={'version':1,'themes':self.values.themes,'typography':self.values.typography,'definitions':{},'screen_candidates':[],'sources':{p:hashlib.sha256(t.encode()).hexdigest() for p,t in self.files.items() if p.endswith('.kt')},'preview':{'theme':self.mode,'density':1,'fontScale':1},'fonts':self.resources.get('fonts',{}),'symbols':{unit.path+':'+name:{'name':name,'source':{'path':unit.path,'start':value.start_byte,'end':value.end_byte,'line':value.start_point.row+1},'expression':unit.text(value)} for (path,name),value in self.index.symbols.items() for unit in [self.index.units[path]]}}
        for k,f in self.index.functions.items():project['definitions'][k]={'name':f.name,'source':{'path':f.unit.path,'start':f.node.start_byte,'end':f.node.end_byte},'parameters':[p[0] for p in f.parameters],'calls':sorted(edges[k]),'kind':'Screen' if k in roots else 'Reusable Component'}
        for k in sorted(roots,key=lambda k:(self.index.functions[k].unit.path,self.index.functions[k].node.start_byte)):
            f=self.index.functions[k];self.use(f.unit);self.function_name=f.name;self.scope={p:self.values.resolve(default,f.unit,mode=self.mode) for p,default in f.parameters if default};self.expanding=[k];self.slots={}
            if f.unit.tree.root_node.has_error:self.warn(f.node,'Kotlin com erros: arquivo preservado sem reconstrução.');continue
            children=[]
            for i,call in enumerate(self.body_calls(f.body)):
                mapped=self.map_node(call,f.name+'/'+str(i))
                if mapped:children.append(mapped)
            if not children:continue
            s=new_screen(f.name,80+len(doc['screens'])*480,80);s['id']=f.name[7:] if f.name.startswith('Screen_s_') else stable('s',f.unit.path+f.name)
            if len(children)==1 and children[0]['type'] in {'Column','Row','Box','ConstraintLayout'}:s['root']=children[0]
            else:s['root']['id']=stable('n',f.unit.path+f.name+'/root');s['root']['layout'].update(padding=0,gap=0);s['root']['children']=children
            project['screen_candidates'].append({'id':s['id'],'name':f.name,'evidence':'navigation destination' if k in destinations else 'entry/call graph root','ambiguous':k not in destinations,'definition':k});doc['screens'].append(s);self.functions.append({'name':f.name,'path':f.unit.path,'screen':s['id'],'route':destinations.get(k)})
        # Direct setContent UI with no named composable roots remains supported.
        if not doc['screens']:
            for unit in self.index.units.values():
                if unit.tree.root_node.has_error:continue
                self.use(unit);self.scope={};self.function_name='setContent'
                for call in nodes(unit.tree.root_node,'call_expression'):
                    if self.call(call)[0]!='setContent':continue
                    children=[]
                    for block in call.named_children:
                        if block.type in {'annotated_lambda','lambda_literal'}:
                            for i,c in enumerate(self.body_calls(block)):
                                mapped=self.map_node(c,'ActivityContent/'+str(i))
                                if mapped:children.append(mapped)
                    if children:
                        s=new_screen('Activity Content');s['id']=stable('s',unit.path+'/setContent');s['root']['id']=stable('n',unit.path+'/setContent/root');s['root']['children']=children;doc['screens'].append(s)
        for (path,name),expression in self.index.symbols.items():
            if name in {'AGATA_HOME','AGATA_LOGIN','AGATA_DASHBOARD'}:
                value=self.values.resolve(expression,self.index.units[path])
                for screen in doc['screens']:
                    if screen['id']==value:screen['name']=name.removeprefix('AGATA_').title()
        doc['screens'].sort(key=lambda s:0 if s['name']=='Home' else 1 if s['name']=='Login' else 2)
        ids={s['id'] for s in doc['screens']};aliases={str(alias).lower():f['screen'] for f in self.functions for alias in (f['name'],f['route']) if alias}
        for s in doc['screens']:
            def normalize(n,parent=None):
                if n['layout']['weight'] and (not parent or parent['type'] not in {'Row','Column'}):
                    n['layout']['weight']=0
                    if n.get('compose',{}).get('base_layout'):n['compose']['base_layout']['weight']=0
                for axis in ('width','height'):
                    if isinstance(n['layout'][axis],(int,float)):n['layout'][axis]=max(n['layout']['min'+axis.title()],min(4096,n['layout'][axis]))
                event=n['events'].get('onClick')
                if event and event['action']=='navigate':
                    event['target']=aliases.get(event['target'].lower(),event['target'])
                    if event['target'] not in ids:event['broken']=True
                for c in n['children']:normalize(c,n)
            normalize(s['root'])
        if doc['screens']:doc['start_screen']=doc['screens'][0]['id'];doc.pop('import_empty',None)
        packages=[f.unit.package for f in self.index.functions.values() if f.key in roots]
        if packages:
            from apps.android_designer.domain.model import NAMESPACE,KEYWORDS
            if NAMESPACE.fullmatch(packages[0]) and not any(p in KEYWORDS for p in packages[0].split('.')):doc['namespace']=packages[0]
        project['node_ids']=[n['id'] for s in doc['screens'] for n in walk(s['root'])]
        project['structure']=hashlib.sha256(str([(n['id'],[c['id'] for c in n['children']]) for s in doc['screens'] for n in walk(s['root'])]).encode()).hexdigest()
        project['theme_candidates']=schemes
        doc['compose_project']=project
        return validate(doc)
