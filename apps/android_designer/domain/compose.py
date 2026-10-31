"""Validate optional Compose extension data without changing legacy v4 documents."""
import math,re

COLORS=re.compile(r'^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$')

def validate_compose(node):
    metadata=node.get('compose')
    if metadata is None:return
    if not isinstance(metadata,dict):raise ValueError('Metadados Compose inválidos.')
    styles=metadata.get('styles',{});ops=metadata.get('modifiers',[])
    if not isinstance(styles,dict) or len(styles)>100 or not isinstance(ops,list) or len(ops)>200:raise ValueError('Estilos ou cadeia Compose inválidos.')
    for key,binding in styles.items():
        if not isinstance(key,str) or not isinstance(binding,dict):raise ValueError('Origem de estilo inválida.')
        if binding.get('status') not in {'Fully supported','Partially supported','Dynamic','Preserved in source','Unsupported',None}:raise ValueError('Status de estilo inválido.')
        value=binding.get('value')
        if key in {'color','background','contentColor'} and isinstance(value,str) and not COLORS.fullmatch(value):raise ValueError('Cor Compose inválida.')
        if key in {'fontSize','lineHeight','letterSpacing','radius','elevation','opacity'} and value is not None:
            if type(value) not in (int,float) or not math.isfinite(value) or not -1000<=value<=4096:raise ValueError('Dimensão de estilo inválida.')
        if key=='fontWeight' and value is not None and value not in {'FontWeight.Thin','FontWeight.ExtraLight','FontWeight.Light','FontWeight.Normal','FontWeight.Medium','FontWeight.SemiBold','FontWeight.Bold','FontWeight.ExtraBold','FontWeight.Black'}:raise ValueError('Peso tipográfico inválido.')
    for op in ops:
        if not isinstance(op,dict) or not isinstance(op.get('type'),str) or not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_]*',op['type']):raise ValueError('Operação Modifier inválida.')
        if not isinstance(op.get('values',[]),list) or not isinstance(op.get('named',{}),dict):raise ValueError('Argumentos Modifier inválidos.')
    condition=metadata.get('conditional',{}).get('rule')
    if condition is not None:
        if not isinstance(condition,dict) or condition.get('operator') not in {'>=','<=','>','<','=='} or condition.get('axis') not in {'width','height'} or type(condition.get('value')) not in (int,float) or not 0<=condition['value']<=4096:raise ValueError('Condição responsiva inválida.')
