"""Tree-sitter Kotlin AST mapper for a documented declarative subset.
Unknown expressions stay in source snapshots and carry diagnostics; never eval/execute.
"""
import json,re,hashlib
import tree_sitter,tree_sitter_kotlin
from apps.android_designer.domain.model import new_document,new_screen,new_node,walk,validate

MAPPING={**{k:k for k in ['LazyColumn','LazyRow','LazyVerticalGrid']},'LazyVerticalStaggeredGrid':'LazyStaggeredGrid','LazyStaggeredGrid':'LazyStaggeredGrid','Column':'Column','Row':'Row','Box':'Box','BoxWithConstraints':'Box','Scaffold':'Column','ConstraintLayout':'ConstraintLayout','Spacer':'Spacer','Text':'TextLabel','Button':'Button','TextButton':'Button','OutlinedButton':'Button','IconButton':'IconButton','Card':'Card','Surface':'Surface','TopAppBar':'TopBar','NavigationBar':'BottomBar','NavigationBarItem':'NavigationItem','TextField':'TextField','OutlinedTextField':'TextField','Checkbox':'Checkbox','Switch':'Switch','Slider':'Slider','Icon':'Icon','Image':'Image'}


def stable(prefix,value):return prefix+'_'+hashlib.sha256(value.encode()).hexdigest()[:24]


def descendants(node,kind=None):
    if kind is None or node.type==kind:yield node
    for child in node.named_children:yield from descendants(child,kind)


class ComposeParser:
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
        text=self.text(node).strip()
        if node.type in {'string_literal','multiline_string_literal'}:
            if '$' in text:return None
            try:return json.loads(text)
            except ValueError:return text[3:-3] if text.startswith('"""') else None
        if text in {'true','false'}:return text=='true'
        if re.fullmatch(r'-?\d+(\.\d+)?[fF]?(\.(dp|sp))?',text):return float(re.sub(r'[fF]$|\.(dp|sp)$','',text))
        if text.startswith('R.string.'):return self.resources['strings'].get(text.split('.')[-1])
        if node.type=='call_expression':
            name,args,pos=self.call(node)
            if name=='stringResource' and (pos or 'id' in args):return self.literal(pos[0] if pos else args['id'])
            if name=='Color' and pos:
                raw=self.text(pos[0]);match=re.fullmatch(r'0x(?:FF)?([0-9A-Fa-f]{6})',raw)
                if match:return '#'+match[1]
            if name=='RoundedCornerShape' and pos:return self.literal(pos[0])
        if text.startswith('Color.'):
            return {'White':'#FFFFFF','Black':'#000000','Red':'#FF0000','Blue':'#0000FF','Green':'#00FF00','Gray':'#808080'}.get(text.split('.')[-1])
        if text.startswith('R.color.'):return self.resources['colors'].get(text.split('.')[-1])
        return None
    def body_calls(self,node):
        # Walk structural blocks/lambdas; don't mistake value arguments/onClick for UI children.
        for c in node.named_children:
            if c.type=='call_expression':yield c
            elif c.type in {'function_body','block','annotated_lambda','lambda_literal'}:yield from self.body_calls(c)
            elif c.type not in {'value_arguments','value_argument','property_declaration','assignment','function_value_parameters','identifier','modifiers'}:
                self.warn(c,'Estrutura dinâmica não reconstruída; fonte preservada: '+c.type)
    def map_node(self,call,key):
        name,args,pos=self.call(call)
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
            self.counts['code_only']+=1;self.warn(call,'Composable/chamada preservada somente em código: '+name);return None
        n=new_node('Box' if theme_wrapper else MAPPING[name]);n['id']=stable('n',self.path+':'+key);n['name']=name;n['children']=[];partial=theme_wrapper
        self.ast[n['id']]=call
        self.provenance[n['id']]={'path':self.path,'start':call.start_byte,'end':call.end_byte,'call':name}
        props={'text':'text','color':'color','fontSize':'fontSize','label':'label','placeholder':'placeholder','value':'value','enabled':'enabled','checked':'checked','selected':'selected','backgroundColor':'background','containerColor':'background','shape':'radius'}
        if name in {'OutlinedButton','TextButton','OutlinedTextField'}:n['props']['variant']={'OutlinedButton':'outlined','TextButton':'text','OutlinedTextField':'outlined'}[name]
        if name=='Text' and pos:args={**args,'text':pos[0]}
        # Kotlin allows positional Modifier after Text's first argument.
        for value in pos:
            if self.text(value).startswith('Modifier'):args={**args,'modifier':value}
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
            if k in {'modifier','onClick','painter','contentDescription'}:continue
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
            for m in descendants(args['modifier'],'call_expression'):
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
                elif method not in {'Modifier','constrainAs','linkTo'}:partial=True;self.warn(m,'Modifier não reconstruído: '+method)
        if 'onClick' in args:
            for action in descendants(args['onClick'],'call_expression'):
                an,aa,ap=self.call(action);values=[self.literal(x) for x in ap]
                if an=='onAction' and len(values)==2 and values[0] in {'navigate','replace','back'} and isinstance(values[1],str):n['events']={'onClick':{'action':'back'} if values[0]=='back' else {'action':'navigate','target':values[1],**({'policy':'replace'} if values[0]=='replace' else {})}};break
                if an=='navigate' and len(values)==1 and isinstance(values[0],str):n['events']={'onClick':{'action':'navigate','target':values[0]}};break
            else:
                if self.text(args['onClick']).strip() not in {'{}','{ }'}:partial=True;self.warn(args['onClick'],'Ação onClick não reconstruída; original preservado.')
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
        if name=='ConstraintLayout':self.constraints(n,call)
        if name in {'Scaffold','BoxWithConstraints','ConstraintLayout'}:partial=True;self.warn(call,'Container reconhecido; slots/regras dinâmicas ou DSL de constraints exigem revisão.')
        self.counts['partially_editable' if partial else 'fully_editable']+=1;n['import_compatibility']='Partially Editable' if partial else 'Fully Editable'
        return n
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
        doc=new_document();doc['screens']=[];doc['start_screen']='';doc['import_empty']=True;namespace=None
        for path,source in sorted(self.files.items()):
            if not path.endswith('.kt'):continue
            self.path=path;self.source=source.encode();tree=self.parser.parse(self.source)
            if tree.root_node.has_error:self.warn(tree.root_node,'Kotlin com erros de parsing; arquivo Code Only.');self.counts['code_only']+=1;continue
            package=next(descendants(tree.root_node,'package_header'),None)
            if package and namespace is None:namespace=self.text(package).removeprefix('package ').strip()
            for function in descendants(tree.root_node,'function_declaration'):
                modifiers=next((c for c in function.named_children if c.type=='modifiers'),None)
                if modifiers is None or 'Composable' not in [self.text(n).split('.')[-1] for n in descendants(modifiers,'user_type')]:continue
                name=next((self.text(c) for c in function.named_children if c.type=='identifier'),None)
                if not name or name.endswith('Preview'):continue
                body=next((c for c in function.named_children if c.type=='function_body'),None)
                if not body:continue
                nodes=[]
                for i,call in enumerate(self.body_calls(body)):
                    mapped=self.map_node(call,name+'/'+str(i))
                    if mapped:nodes.append(mapped)
                if not nodes:continue
                s=new_screen(name,80+len(doc['screens'])*480,80);s['id']=name[7:] if name.startswith('Screen_s_') else stable('s',path+name)
                if len(nodes)==1 and nodes[0]['type'] in {'Column','Row','Box','ConstraintLayout'}:s['root']=nodes[0]
                else:s['root']['id']=stable('n',path+name+'/root');s['root']['children']=nodes
                doc['screens'].append(s);self.functions.append({'name':name,'path':path,'screen':s['id']})
            # A valid empty Android Studio setContent/Scaffold is still an editable Screen.
            for call in descendants(tree.root_node,'call_expression'):
                name,_,_=self.call(call)
                if name!='setContent':continue
                nodes=[]
                for block in call.named_children:
                    if block.type not in {'annotated_lambda','lambda_literal'}:continue
                    for i,child in enumerate(self.body_calls(block)):
                        mapped=self.map_node(child,'ActivityContent/'+str(i))
                        if mapped:nodes.append(mapped)
                if nodes:
                    s=new_screen('Activity Content',80+len(doc['screens'])*480,80);s['id']=stable('s',path+'/setContent');s['root']['id']=stable('n',path+'/setContent/root');s['root']['children']=nodes;doc['screens'].append(s)
        ids={s['id'] for s in doc['screens']};aliases={x['name'].lower():x['screen'] for x in self.functions}
        for s in doc['screens']:
            def normalize(n,parent=None):
                if n['layout']['weight'] and (not parent or parent['type'] not in {'Row','Column'}):n['layout']['weight']=0;self.warnings.append({'path':'model','message':'Peso incompatível mantido somente na fonte.'})
                for axis in ('width','height'):
                    if isinstance(n['layout'][axis],(int,float)):n['layout'][axis]=max(n['layout']['min'+axis.title()],min(4096,n['layout'][axis]))
                e=n['events'].get('onClick')
                if e and e['action']=='navigate':
                    e['target']=aliases.get(e['target'].lower(),e['target'])
                    if e['target'] not in ids:e['broken']=True
                for c in n['children']:normalize(c,n)
            normalize(s['root'])
        if namespace:
            from apps.android_designer.domain.model import NAMESPACE,KEYWORDS
            if NAMESPACE.fullmatch(namespace) and not any(p in KEYWORDS for p in namespace.split('.')):doc['namespace']=namespace
        if doc['screens']:doc['start_screen']=doc['screens'][0]['id'];doc.pop('import_empty',None)
        return validate(doc)
