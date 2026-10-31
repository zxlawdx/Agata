"""Walk receiver chains in Kotlin execution order, not recursive prefix traversal."""

def ordered(node,call):
    if node.type!='call_expression':return []
    first=node.named_children[0] if node.named_children else None
    if first is None:return []
    if first.type=='call_expression':return ordered(first,call)
    previous=[]
    if first.type=='navigation_expression' and first.named_children:
        previous=ordered(first.named_children[0],call)
    return [*previous,node]

CATEGORIES={'padding':'measurement','width':'measurement','height':'measurement','size':'measurement','fillMaxWidth':'measurement','fillMaxHeight':'measurement','fillMaxSize':'measurement','widthIn':'measurement','heightIn':'measurement','verticalScroll':'measurement','horizontalScroll':'measurement','weight':'parentData','align':'parentData','matchParentSize':'parentData','background':'drawing','border':'drawing','clip':'drawing','alpha':'drawing','zIndex':'placement','offset':'placement','clickable':'interaction','constrainAs':'parentData','semantics':'semantics'}

def parse_chain(parser,node):
    operations=[]
    chain=ordered(node,parser.call)
    if chain:
        first=chain[0].named_children[0]
        if first.type=='navigation_expression' and first.named_children:
            base=parser.literal(first.named_children[0])
            if isinstance(base,dict):operations.extend(base.get('modifier_chain',[]))
    for call in chain:
        name,args,pos=parser.call(call)
        if name=='then':parser.warn(call,'Modifier.then preservado sem expansão; ordem registrada.')
        operation={'type':name,'category':CATEGORIES.get(name,'unsupported'),'source':parser.location(call),'positional_sources':[{'expression':parser.text(v),**parser.location(v)} for v in pos],'named_sources':{k:{'expression':parser.text(v),**parser.location(v)} for k,v in args.items()},'arguments':{k:parser.text(v) for k,v in args.items()},'expression':parser.text(call),'values':[parser.literal(v) for v in pos],'named':{k:parser.literal(v) for k,v in args.items()}}
        operation['status']='Fully supported' if name in CATEGORIES and all(v is not None for v in operation['values']+list(operation['named'].values())) else 'Preserved in source'
        operations.append(operation)
    return operations
