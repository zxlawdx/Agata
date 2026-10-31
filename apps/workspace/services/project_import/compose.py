"""Tree-sitter Kotlin AST mapper for a documented declarative subset.
Unknown expressions stay in source snapshots and carry diagnostics; never eval/execute.
"""
import json,re,hashlib
import tree_sitter,tree_sitter_kotlin
from apps.android_designer.domain.model import new_document,new_screen,new_node,walk,validate

MAPPING={**{k:k for k in ['LazyColumn','LazyRow','LazyVerticalGrid']},'LazyVerticalStaggeredGrid':'LazyStaggeredGrid','LazyStaggeredGrid':'LazyStaggeredGrid','HorizontalDivider':'Divider','VerticalDivider':'Divider','BasicText':'TextLabel','Column':'Column','Row':'Row','Box':'Box','BoxWithConstraints':'Box','Scaffold':'Column','ConstraintLayout':'ConstraintLayout','Spacer':'Spacer','Text':'TextLabel','Button':'Button','TextButton':'Button','OutlinedButton':'Button','IconButton':'IconButton','Card':'Card','Surface':'Surface','TopAppBar':'TopBar','NavigationBar':'BottomBar','NavigationBarItem':'NavigationItem','TextField':'TextField','OutlinedTextField':'TextField','Checkbox':'Checkbox','Switch':'Switch','Slider':'Slider','Icon':'Icon','Image':'Image'}


def stable(prefix,value):return prefix+'_'+hashlib.sha256(value.encode()).hexdigest()[:24]


def descendants(node,kind=None):
    if kind is None or node.type==kind:yield node
    for child in node.named_children:yield from descendants(child,kind)


from .compose_fidelity import Fidelity

class ComposeParser(Fidelity):
    def __init__(self,files,resources):
        self.files=files;self.resources=resources;self.warnings=[];self.provenance={};self.functions=[];self.ast={};self.source=b'';self.path='';self.counts={'fully_editable':0,'partially_editable':0,'code_only':0}
        self.parser=tree_sitter.Parser(tree_sitter.Language(tree_sitter_kotlin.language()))
    def text(self,n):return self.source[n.start_byte:n.end_byte].decode()
    def warn(self,n,message):self.warnings.append({'path':self.path,'line':n.start_point.row+1,'message':message})
    def call(self,node):
        current=node
        while current.type=='call_expression' and current.named_children and current.named_children[0].type=='call_expression':current=current.named_children[0]
        first=current.named_children[0] if current.named_children else current
        name=self.text(first).split('.')[-1];args={};positional=[]
        arguments=next((c for c in current.named_children if c.type=='value_arguments'),None)
        if arguments:
            for arg in arguments.named_children:
                if arg.type!='value_argument':continue
                children=arg.named_children
                if len(children)>=2 and children[0].type=='identifier':args[self.text(children[0])]=children[-1]
                elif children:positional.append(children[-1])
        return name,args,positional
    def literal(self,node):
        if node is None:return None
        if hasattr(self,'values'):return self.values.resolve(node,self.unit,self.scope,self.mode)
        return None
    def body_calls(self,node):
        # Walk structural blocks/lambdas; don't mistake value arguments/onClick for UI children.
        for c in node.named_children:
            if c.type in {'call_expression','if_expression'}:yield c
            elif c.type=='property_declaration' and hasattr(self,'scope'):
                variable=next(descendants(c,'variable_declaration'),None)
                if variable and c.named_children[-1].type!='variable_declaration':
                    value=c.named_children[-1];raw=self.text(value);self.scope[self.text(variable)]={'condition':raw} if re.fullmatch(r'(maxWidth|maxHeight)\s*(>=|<=|>|<|==)\s*\d+(?:\.\d+)?\.dp',raw) else {'__expression__':value,'__unit__':self.unit,'__scope__':self.scope.copy()}
            elif c.type in {'function_body','block','annotated_lambda','lambda_literal'}:yield from self.body_calls(c)
            elif c.type not in {'value_arguments','value_argument','property_declaration','assignment','function_value_parameters','identifier','modifiers'}:
                self.warn(c,'Estrutura dinâmica não reconstruída; fonte preservada: '+c.type)
    def map_node(self,call,key):
        self.node_budget=getattr(self,'node_budget',0)+1
        if self.node_budget>3000:raise ValueError('Importação excede 3.000 nós visuais; reduza a expansão de componentes.')
        if call.type=='if_expression':return self.conditional(call,key)
        name,args,pos=self.call(call)
        if hasattr(self,'slots') and name in self.slots:
            block,unit,scope=self.slots[name];oldunit,oldscope=self.unit,self.scope;self.use(unit);self.scope=scope
            wrapper=new_node('Box');wrapper['id']=stable('n',self.path+key);wrapper['children']=[]
            try:
                for i,child in enumerate(self.body_calls(block)):
                    mapped=self.map_node(child,key+'/slot'+str(i))
                    if mapped:wrapper['children'].append(mapped)
            finally:self.use(oldunit);self.scope=oldscope
            return wrapper
        function=self.index.resolve(name,self.unit) if hasattr(self,'index') else None
        if function and name not in MAPPING:return self.instance(function,args,pos,call,key)
        if name in {'item','items'}:
            if name=='item':
                wrapper=new_node('Box');wrapper['id']=stable('n',self.path+':'+key);wrapper['children']=[]
                for block in call.named_children:
                    if block.type in {'annotated_lambda','lambda_literal'}:
                        for i,child in enumerate(self.body_calls(block)):
                            mapped=self.map_node(child,key+'/item'+str(i))
                            if mapped:wrapper['children'].append(mapped)
                return wrapper
            self.counts['code_only']+=1;self.warn(call,'items dinâmico preservado em código; forneça itens visuais explícitos para editar.');return None
        theme_wrapper=name.endswith('Theme') and any(c.type in {'annotated_lambda','lambda_literal'} for c in call.named_children)
        if theme_wrapper:
            self.warn(call,'Theme personalizado preservado na fonte; conteúdo estático reconstruído parcialmente.')
        if name not in MAPPING and not theme_wrapper:
            self.counts['code_only']+=1;self.warn(call,'Composable/chamada preservada somente em código: '+name)
            n=new_node('Box');n['id']=stable('n',self.path+':'+key);n['name']=name;n['layout'].update(width='fill',height=48);n['compose']={'styles':{},'modifiers':[],'source':self.location(call),'placeholder':'Custom Composable — preview unavailable'};return n
        n=new_node('Box' if theme_wrapper else MAPPING[name]);n['id']=stable('n',self.path+':'+key);n['name']=name;n['children']=[];partial=theme_wrapper
        if n['type'] in {'Column','Row','Box','TextLabel','Card','Surface','Button','IconButton','TextField','TopBar','BottomBar'}:n['layout'].update(padding=0,gap=0,width='wrap',height='wrap')
        if n['type']=='TextField':n['props'].update(label='',placeholder='',helper='',error='',keyboard='text')
        self.ast[n['id']]=call
        self.provenance[n['id']]={'path':self.path,'start':call.start_byte,'end':call.end_byte,'call':name}
        props={'text':'text','color':'color','fontSize':'fontSize','label':'label','placeholder':'placeholder','value':'value','enabled':'enabled','checked':'checked','selected':'selected','backgroundColor':'background','containerColor':'background','shape':'radius'}
        if name in {'OutlinedButton','TextButton','OutlinedTextField'}:n['props']['variant']={'OutlinedButton':'outlined','TextButton':'text','OutlinedTextField':'outlined'}[name]
        if name in {'Text','BasicText'} and pos:args={**args,'text':pos[0]}
        # Kotlin allows positional Modifier after Text's first argument.
        for value in pos:
            if self.text(value).startswith(('Modifier','modifier')) or isinstance(self.literal(value),dict) and 'modifier_chain' in self.literal(value):args={**args,'modifier':value}
        if name in {'Image','Icon'}:
            painter=args.get('painter') or (pos[0] if pos else None)
            if painter:
                pn,pa,pp=self.call(painter)
                resource=pa.get('id') or (pp[0] if pp else None)
                raw=self.text(resource) if resource else ''
                if pn=='painterResource' and raw.startswith('R.drawable.'):
                    resource_name=raw.split('.')[-1]
                    if name=='Image' and resource_name in self.resources['images']:n['props']['source']=self.resources['images'][resource_name]
                    elif name=='Icon' and resource_name.removeprefix('agata_') in {'none','menu','back','home','search','close','settings','plus'} and resource_name.startswith('agata_'):n['props']['icon']=resource_name.removeprefix('agata_')
                    else:partial=True;self.warn(painter,'Drawable preservado no snapshot; sem conversão visual disponível.')
            if 'contentDescription' in args:
                description=self.literal(args['contentDescription'])
                if isinstance(description,str):n['props']['description']=description

        for k,v in args.items():
            if k in {'modifier','onClick','painter','contentDescription','colors','shape','style','fontWeight','textAlign','verticalArrangement','horizontalArrangement','horizontalAlignment','verticalAlignment','contentAlignment','lineHeight','letterSpacing','fontFamily','fontStyle','softWrap','textDecoration','tonalElevation','shadowElevation','contentColor'}:continue
            if k=='fontWeight' and n['type']=='TextLabel' and self.text(v) in {'FontWeight.Bold','FontWeight.Normal'}:n['props']['bold']=self.text(v).endswith('Bold');continue
            target=props.get(k)
            if target and target in n['props']:
                value=self.literal(v)
                if value is not None and isinstance(value,type(n['props'][target])) or value is not None and isinstance(n['props'][target],(int,float)) and type(value) in (int,float):n['props'][target]=value
                else:partial=True;self.warn(v,'Expressão dinâmica de '+k+' preservada.')
            elif k=='columns' and name in {'LazyVerticalGrid','LazyVerticalStaggeredGrid','LazyStaggeredGrid'}:
                method,ca,cp=self.call(v);count=self.literal(cp[0]) if cp else None
                if method=='Fixed' and isinstance(count,(int,float)) and count.is_integer() and 1<=count<=12:n['layout']['columns']=int(count)
                else:partial=True;self.warn(v,'Colunas adaptativas/dinâmicas preservadas na fonte.')
            elif k in {'content','title','actions','navigationIcon','topBar','bottomBar','floatingActionButton','label','icon'} and any(c.type=='lambda_literal' for c in descendants(v)):
                for i,child in enumerate(self.body_calls(v)):
                    mapped=self.map_node(child,key+'/'+k+str(i))
                    if mapped:mapped['role']='title' if k=='title' else 'action' if k=='actions' else 'navigation' if k=='navigationIcon' else '';n['children'].append(mapped)
            else:partial=True;self.warn(v,'Argumento preservado sem edição visual: '+k)
        if 'modifier' in args:
            from .compose_modifiers import ordered
            for m in ordered(args['modifier'],self.call):
                method,ma,mp=self.call(m);value=self.literal(mp[0]) if mp else None
                if method in {'fillMaxWidth','fillMaxHeight','fillMaxSize'}:
                    if method!='fillMaxHeight':n['layout']['width']='fill'
                    if method!='fillMaxWidth':n['layout']['height']='fill'
                elif method in {'width','height','padding','weight'} and isinstance(value,(int,float)):n['layout'][method]=value
                elif method=='size' and isinstance(value,(int,float)):n['layout']['width']=value;n['layout']['height']=self.literal(mp[1]) if len(mp)>1 else value
                elif method=='background' and isinstance(value,str) and 'background' in n['props']:n['props']['background']=value
                elif method=='offset':
                    for axis,arg in zip(('x','y'),mp):
                        val=self.literal(arg)
                        if isinstance(val,(int,float)) and val>=0:n['layout'][axis]=val
                    partial=True;self.warn(m,'Offset preservado; não altera semântica Auto Layout.')
                elif method not in {'widthIn','heightIn','verticalScroll','horizontalScroll','Modifier','constrainAs','linkTo','background','border','clip','alpha','zIndex','align','matchParentSize'}:partial=True;self.warn(m,'Modifier não reconstruído: '+method)
        if 'onClick' in args:
            event=self.action_value(args['onClick'])
            if event:n['events']={'onClick':event}
            elif self.text(args['onClick']).strip() not in {'{}','{ }'}:partial=True;self.warn(args['onClick'],'Callback dinâmico preservado no fonte.')
        previous_themes=self.values.themes;previous_scope=self.scope.copy();content_color=self.style(n,name,args)
        if content_color:self.scope['LocalContentColor.current']=content_color
        lambdas=[c for c in call.named_children if c.type in {'annotated_lambda','lambda_literal'}]
        for block in lambdas:
            for i,child in enumerate(self.body_calls(block)):
                mapped=self.map_node(child,key+'/'+str(i))
                if mapped:n['children'].append(mapped)
        # Restore sensible slots, without pretending a label lambda is a child container.
        if n['type']=='TextField' and 'label' in args and not n['props']['label']:
            texts=[self.text(x) for x in descendants(args['label'],'string_literal')]
            if texts:n['props']['label']=json.loads(texts[0])
        if n['children'] and not n['type'] in {'Column','Row','Box','ConstraintLayout','Button','IconButton','Card','Surface','TopBar','BottomBar','NavigationItem','LazyColumn','LazyRow','LazyVerticalGrid','LazyStaggeredGrid'}:
            partial=True;n['children']=[]
        if n['type']=='Row' and any(c['layout']['weight'] for c in n['children']):n['layout']['width']='fill'
        if name=='ConstraintLayout':self.constraints(n,call)
        if name in {'Scaffold','BoxWithConstraints','ConstraintLayout'}:partial=True;self.warn(call,'Container reconhecido; slots/regras dinâmicas ou DSL de constraints exigem revisão.')
        self.counts['partially_editable' if partial else 'fully_editable']+=1;n['import_compatibility']='Partially Editable' if partial else 'Fully Editable'
        self.scope=previous_scope;self.values.themes=previous_themes
        return self.finish(n)
    def constraints(self,parent,call):
        """Static refs, guidelines and constrainAs only; no external ConstraintSets/chains."""
        refs={'parent':'parent'};pending=[]
        blocks=[c for c in call.named_children if c.type in {'annotated_lambda','lambda_literal'}]
        for block in blocks:
            literals=[c for c in block.named_children if c.type=='lambda_literal'] or [block]
            for literal in literals:
                for declaration in literal.named_children:
                    if declaration.type!='property_declaration':continue
                    variable=next(descendants(declaration,'variable_declaration'),None)
                    value=next((c for c in declaration.named_children if c.type=='call_expression'),None)
                    if variable is None or value is None:continue
                    ref=self.text(variable);method,args,pos=self.call(value)
                    if method=='createRef':refs[ref]=None
                    elif method in {'createGuidelineFromStart','createGuidelineFromEnd','createGuidelineFromTop','createGuidelineFromBottom'} and pos:
                        percent=self.literal(pos[0])
                        if isinstance(percent,(int,float)) and 0<=percent<=1:
                            helper=new_node('Guideline');helper['id']=stable('n',parent['id']+'/'+ref);helper['name']=ref;helper['props'].update(orientation='vertical' if method.endswith(('Start','End')) else 'horizontal',percent=1-percent if method.endswith(('End','Bottom')) else percent);parent['children'].append(helper);refs[ref]=helper['id'];self.counts['fully_editable']+=1
        for child in parent['children']:
            ast=self.ast.get(child['id'])
            if ast is None:continue
            for modifier in descendants(ast,'call_expression'):
                method,args,pos=self.call(modifier)
                if method!='constrainAs' or not pos:continue
                # Only the outer call owns the lambda; inner call is ignored.
                block=next((c for c in modifier.named_children if c.type in {'annotated_lambda','lambda_literal'}),None)
                if block is None:continue
                ref=self.text(pos[0]);refs[ref]=child['id'];pending.append((child,block));break
        for child,block in pending:
            for link in descendants(block,'call_expression'):
                method,args,pos=self.call(link)
                if method!='linkTo' or not pos:continue
                callee=link.named_children[0];parts=self.text(callee).split('.')
                if len(parts)!=2 or parts[0] not in {'start','end','top','bottom','baseline'}:self.warn(link,'linkTo complexo preservado somente na fonte.');continue
                anchor=parts[0];target=self.text(pos[0]).split('.');ref=refs.get(target[0]);target_anchor=target[1] if len(target)==2 else anchor
                margin=self.literal(args['margin']) if 'margin' in args else self.literal(pos[1]) if len(pos)>1 else 0
                if ref and isinstance(margin,(int,float)) and margin>=0:child['layout']['constraints'][anchor]={'target':ref,'anchor':target_anchor,'margin':margin}
                else:self.warn(link,'Referência ou margem de constraint não resolvida; fonte preservada.')
            for assignment in descendants(block,'assignment'):
                if len(assignment.named_children)!=2:continue
                key,value=assignment.named_children;key=self.text(key);raw=self.text(value)
                if key in {'width','height'} and raw in {'Dimension.fillToConstraints','Dimension.wrapContent'}:child['layout'][key]='fill' if raw.endswith('fillToConstraints') else 'wrap'
                elif key in {'horizontalBias','verticalBias'}:
                    bias=self.literal(value)
                    if isinstance(bias,(int,float)) and 0<=bias<=1:child['layout'][key]=bias
                else:self.warn(assignment,'Regra de constraint preservada somente na fonte: '+key)
        try:
            from apps.android_designer.domain.constraints import validate_container
            validate_container(parent)
        except ImportError:pass
        except ValueError as exc:
            for child in parent['children']:child['layout']['constraints']={}
            self.warn(call,'Constraints incompatíveis preservadas somente em código: '+str(exc))

    def parse(self):
        return self.parse_project()
