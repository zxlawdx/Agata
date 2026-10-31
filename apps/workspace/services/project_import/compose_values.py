"""Bounded static resolution, scoped to source units and explicit preview context."""
import json,re
from .compose_index import nodes

class Values:
    def __init__(self,index,call,resources):self.index=index;self.call=call;self.resources=resources;self.themes={};self.typography={};self.shapes={}
    def resolve(self,node,unit,scope=None,mode='dark',seen=()):
        if node is None or len(seen)>24:return None
        scope=scope or {};text=unit.text(node).strip();token=(unit.path,node.start_byte,mode)
        if token in seen:return None
        seen=(*seen,token)
        if text in scope:
            value=scope[text]
            if isinstance(value,dict) and '__expression__' in value:return self.resolve(value['__expression__'],value['__unit__'],value['__scope__'],mode,seen)
            return value
        if text=='Modifier':return {'modifier_chain':[]}
        if text in {'true','false'}:return text=='true'
        if text in {'true','false'}:return text=='true'
        if text=='null':return None
        if node.type in {'string_literal','multiline_string_literal'}:
            if '$' in text:return None
            try:return json.loads(text)
            except ValueError:return text[3:-3] if text.startswith('"""') else None
        if re.fullmatch(r'-?\d+(\.\d+)?[fF]?(\.(dp|sp))?',text):return float(re.sub(r'[fF]$|\.(dp|sp)$','',text))
        if text.startswith('MaterialTheme.colorScheme.'):return self.themes.get(mode,{}).get(text.split('.')[-1])
        if text.startswith('MaterialTheme.typography.'):return self.typography.get(text.split('.')[-1])
        if text.startswith('MaterialTheme.shapes.'):return self.shapes.get(text.split('.')[-1])
        if text.startswith(('R.string.','R.color.')):
            kind='strings' if text.startswith('R.string.') else 'colors';key=text.split('.')[-1];variants=self.resources.get('variants',{}).get(kind,{}).get(key,{})
            value=variants.get('values-night' if mode=='dark' and 'values-night' in variants else 'values',{}).get('value',self.resources[kind].get(key))
            for _ in range(12):
                if not isinstance(value,str) or not value.startswith('@color/'):break
                value=self.resources['colors'].get(value.split('/')[-1])
            if kind=='colors' and isinstance(value,str) and value.startswith('#'):
                raw=value[1:];raw=''.join(c*2 for c in raw) if len(raw) in (3,4) else raw
                if len(raw)==8 and raw[:2].lower()=='ff':raw=raw[2:]
                value='#'+raw.upper()
            return value
        if text.startswith('Color.'):
            return {'White':'#FFFFFF','Black':'#000000','Red':'#FF0000','Blue':'#0000FF','Green':'#00FF00','Gray':'#808080','Transparent':'#00000000'}.get(text.split('.')[-1])
        if text in {'LocalContentColor.current','LocalTextStyle.current'}:return scope.get(text)
        if node.type in {'identifier','navigation_expression'}:
            symbol=self.index.symbol(text,unit)
            if symbol:return self.resolve(symbol[1],symbol[0],{},mode,seen)
        if node.type=='property_delegate' and node.named_children:return self.resolve(node.named_children[-1],unit,scope,mode,seen)
        if node.type=='if_expression':
            children=node.named_children
            if len(children)>=3:
                condition=self.resolve(children[0],unit,scope,mode,seen)
                if isinstance(condition,bool):return self.resolve(children[1] if condition else children[2],unit,scope,mode,seen)
        if node.type=='block' and len(node.named_children)==1:return self.resolve(node.named_children[0],unit,scope,mode,seen)
        if node.type=='call_expression':
            name,args,pos=self.call(node,unit);get=lambda x:self.resolve(x,unit,scope,mode,seen)
            if name=='spacedBy' and pos:return {'spacing':get(pos[0])}
            if name=='isSystemInDarkTheme':return mode=='dark'
            if name in {'stringResource','colorResource','painterResource'}:return get(args.get('id') or (pos[0] if pos else None))
            if name=='Color' and pos:
                raw=unit.text(pos[0]);m=re.fullmatch(r'0x([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})[lL]?',raw)
                if m:
                    value=m[1].upper();return '#'+(value[2:] if len(value)==8 and value.startswith('FF') else value)
            if name=='listOf':return [get(v) for v in pos]
            if name in {'linearGradient','verticalGradient','horizontalGradient'} and pos:
                colors=get(pos[0]);return {'gradient':name,'colors':colors} if isinstance(colors,list) and all(isinstance(v,str) for v in colors) else None
            if name in {'mutableStateOf','rememberSaveable','remember'}:
                for c in nodes(node,'call_expression'):
                    cn,ca,cp=self.call(c,unit)
                    if cn=='mutableStateOf' and cp:return get(cp[0])
            if name in {'RoundedCornerShape','CutCornerShape'}:
                value=get(pos[0]) if pos else get(args.get('size'))
                return {'kind':name,'radius':value,'percent':bool(pos and pos[0].type=='number_literal')} if value is not None else None
            if name in {'FontFamily','Font'}:
                if name=='FontFamily' and pos:return get(pos[0])
                if pos:
                    ref=unit.text(pos[0]).split('.')[-1];font=self.resources.get('fonts',{}).get(ref)
                    return {'font':ref,'fingerprint':__import__('hashlib').sha256(font.encode()).hexdigest()[:16]} if font else None
            if name in {'darkColorScheme','lightColorScheme','Typography','Shapes','TextStyle','buttonColors','cardColors','colors','topAppBarColors','elevatedCardColors','outlinedCardColors','outlinedButtonColors','textButtonColors','filledTonalButtonColors'}:
                return {'constructor':name,**{k:get(v) for k,v in args.items()}}
        if text.startswith('FontWeight.'):
            names=['Thin','ExtraLight','Light','Normal','Medium','SemiBold','Bold','ExtraBold','Black'];value=text.split('.')[-1]
            if re.fullmatch(r'W[1-9]00',value):value=names[int(value[1:])//100-1]
            return 'FontWeight.'+value if value in names else None
        if text.startswith(('FontWeight.','TextAlign.','TextOverflow.','FontStyle.','TextDecoration.','FontFamily.','Alignment.','Arrangement.','Dimension.')):return text
        return None
    def discover(self):
        # Only unambiguous constructor definitions. Multiple schemes stay diagnostic.
        schemes={'dark':[],'light':[]};typographies=[];shapes=[]
        for unit in self.index.units.values():
            if unit.tree.root_node.has_error:continue
            for call in nodes(unit.tree.root_node,'call_expression'):
                name,_,_=self.call(call,unit)
                if name in {'darkColorScheme','lightColorScheme'}:
                    mode='dark' if name.startswith('dark') else 'light';value=self.resolve(call,unit,mode=mode)
                    if value and value not in schemes[mode]:schemes[mode].append(value)
                elif name=='Typography':
                    value=self.resolve(call,unit)
                    if value and value not in typographies:typographies.append(value)
                elif name=='Shapes':
                    value=self.resolve(call,unit)
                    if value and value not in shapes:shapes.append(value)
        self.themes={k:v[0] for k,v in schemes.items() if len(v)==1}
        self.typography=typographies[0] if len(typographies)==1 else {};self.shapes=shapes[0] if len(shapes)==1 else {}
        return schemes
