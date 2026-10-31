"""Emit the supported ordered modifier subset without flattening its semantics."""
import re

def scalar(value,unit='dp'):
    if type(value) in (int,float):return str(value)+'.'+unit
    if isinstance(value,str) and re.fullmatch(r'#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?',value):return 'Color(0x'+('FF'+value[1:] if len(value)==7 else value[1:])+')'
    if isinstance(value,dict) and value.get('gradient') in {'linearGradient','verticalGradient','horizontalGradient'}:
        colors=[scalar(c) for c in value.get('colors',[])]
        if colors and all(colors):return 'androidx.compose.ui.graphics.Brush.'+value['gradient']+'(listOf('+', '.join(colors)+'))'
    if isinstance(value,dict) and value.get('kind')=='RoundedCornerShape' and type(value.get('radius')) in (int,float):return 'RoundedCornerShape('+str(int(value['radius']))+')' if value.get('percent') else 'RoundedCornerShape('+str(value['radius'])+'.dp)'
    return None


def modifier(n):
    meta=n.get('compose',{});ops=meta.get('modifiers')
    if not ops:return None
    output='Modifier'+n.get('_constraint_modifier','')+('.fillMaxWidth()' if meta.get('instance_fill') else '')
    for op in ops:
        kind=op['type'];values=list(op.get('values',[]));named=dict(op.get('named',{}))
        if kind=='background' and meta.get('styles',{}).get('background',{}).get('override'):
            value=meta['styles']['background']['value']
            if values:values[0]=value
            else:named['color']=value
        if kind in {'verticalScroll','horizontalScroll'}:output+='.'+kind+'(rememberScrollState())';continue
        if kind in {'constrainAs','weight','align'}:continue
        if kind in {'padding','width','height','widthIn','heightIn','size','offset','background','border','clip','alpha','zIndex','fillMaxWidth','fillMaxHeight','fillMaxSize','matchParentSize'}:
            unitless=kind in {'alpha','zIndex','fillMaxWidth','fillMaxHeight','fillMaxSize'}
            args=[];valid=True
            for key,value in [(None,v) for v in values]+list(named.items()):
                if unitless and type(value) in (int,float):value=str(float(value))+'f'
                else:value=scalar(value)
                if value is None:valid=False;break
                args.append((key+' = ' if key else '')+value)
            if valid:output+='.'+kind+'('+', '.join(args)+')'
    if n['layout']['weight']:output+='.weight('+str(float(n['layout']['weight']))+'f)'
    # Instance edits replace only corresponding measured properties, after the chain.
    for key in ('width','height','padding'):
        value=n['layout'][key]
        if value!=meta.get('base_layout',{}).get(key):
            if value=='fill':output+='.'+('fillMaxWidth()' if key=='width' else 'fillMaxHeight()')
            elif type(value) in (int,float):output+='.'+key+'('+str(value)+'.dp)'
    return output


def color(n,key):
    value=n['props'].get(key);meta=n.get('compose',{})
    if value==meta.get('base_props',{}).get(key):
        binding=meta.get('styles',{}).get(key,{})
        reference=binding.get('expression','')
        if re.fullmatch(r'MaterialTheme.colorScheme.[a-zA-Z]+',reference) or reference=='LocalContentColor.current':return reference
        if isinstance(binding.get('value'),str) and binding['value'].startswith('#'):value=binding['value']
    return scalar(value)


def material_colors(n,constructor):
    value=n.get('compose',{}).get('styles',{}).get('materialColors',{}).get('value')
    if not isinstance(value,dict):return None
    value=dict(value);metadata=n.get('compose',{});baseline=metadata.get('base_props',{})
    if 'background' in n['props'] and n['props']['background']!=baseline.get('background'):
        value['contentColor' if n['props'].get('variant') in {'text','outlined'} else 'containerColor']=n['props']['background']
    args=[]
    for key,color_value in value.items():
        if key=='constructor' or not re.fullmatch(r'[a-zA-Z]+Color',key):continue
        binding=metadata.get('styles',{}).get(key,{})
        if binding.get('override'):color_value=binding['value']
        reference=binding.get('expression','');encoded=reference if re.fullmatch(r'MaterialTheme.colorScheme.[a-zA-Z]+',reference) and not binding.get('override') else scalar(color_value)
        if encoded and isinstance(color_value,str) and color_value.startswith('#'):args.append(key+' = '+encoded)
    return constructor+'('+', '.join(args)+')' if args else None
