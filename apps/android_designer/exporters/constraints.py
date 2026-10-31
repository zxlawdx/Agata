"""Native constraint code generation for the supported required-link subset."""
import copy
from xml.etree import ElementTree as ET
A='http://schemas.android.com/apk/res/android';APP='http://schemas.android.com/apk/res-auto'


def compose_container(generator,n,omit=()):
    refs={c['id']:'r_'+c['id'] for c in n['children']};helpers={c['id']:c for c in n['children'] if c['type'] in {'Guideline','Barrier'}}
    declarations=[f'val {refs[c["id"]]} = createRef()' for c in n['children'] if c['id'] not in helpers]
    remaining=dict(helpers)
    while remaining:
        progressed=False
        for key,c in list(remaining.items()):
            p=c['props'];ref=refs[key]
            if c['type']=='Guideline':declarations.append(f'val {ref} = createGuidelineFrom{"Start" if p["orientation"]=="vertical" else "Top"}({float(p["percent"])}f)')
            else:
                targets=p['references'].split()
                if any(t in remaining for t in targets):continue
                declarations.append(f'val {ref} = create{p["direction"].title()}Barrier('+', '.join(refs[t] for t in targets)+f', margin = {p["barrierMargin"]}.dp)')
            del remaining[key];progressed=True
        if not progressed:raise ValueError('Dependências de helpers cíclicas.')
    output=[]
    for child in n['children']:
        if child['id'] in helpers:continue
        c=copy.deepcopy(child);l=c['layout'];rules=[]
        for anchor,link in l['constraints'].items():
            target=link['target'];dest='parent.'+link['anchor'] if target=='parent' else refs[target]+('' if target in helpers else '.'+link['anchor'])
            rules.append(f'{anchor}.linkTo({dest}, margin = {link["margin"]}.dp)')
        for axis,first,last,bias in [('width','start','end','horizontalBias'),('height','top','bottom','verticalBias')]:
            val=l[axis];dim='fillToConstraints' if val=='fill' and first in l['constraints'] and last in l['constraints'] else 'wrapContent' if val in {'wrap','fill'} else f'value({val}.dp)'
            if dim=='fillToConstraints':
                minimum=l['min'+axis.title()];maximum=l['max'+axis.title()]
                if minimum:dim+=f'.atLeast({minimum}.dp)'
                if maximum<4096:dim+=f'.atMost({maximum}.dp)'
            rules.append(f'{axis} = Dimension.{dim}')
            if first not in l['constraints'] and last not in l['constraints'] and not (axis=='height' and 'baseline' in l['constraints']):rules.append(f'{first}.linkTo(parent.{first}, margin = {l["x" if axis=="width" else "y"]}.dp)')
            rules.append(f'{bias} = {float(l[bias])}f')
        if l['aspectRatio'] and l['height']=='fill':rules.append(f'height = Dimension.ratio("{l["aspectRatio"]}:1")')
        c['_constraint_modifier']='.constrainAs('+refs[c['id']]+') { '+'; '.join(rules)+' }'
        output.append(generator.emit(c,omit))
    return 'ConstraintLayout(modifier = '+generator.modifier(n)+') {\n'+'\n'.join(declarations+output)+'\n}'


def xml_container(generator,n):
    l=n['layout'];size=lambda key:{'fill':'match_parent','wrap':'wrap_content'}.get(str(l[key]),f'{l[key]}dp')
    v=ET.Element('androidx.constraintlayout.widget.ConstraintLayout',{f'{{{A}}}id':'@+id/'+n['id'],f'{{{A}}}layout_width':size('width'),f'{{{A}}}layout_height':size('height'),f'{{{A}}}padding':f'{l["padding"]}dp'})
    if n.get('_layer'):
        v.set(f'{{{A}}}alpha',str(n['_layer']['opacity']));v.set(f'{{{A}}}translationZ',str(n['_layer']['order'])+'dp')
    if not l['visible']:v.set(f'{{{A}}}visibility','gone')
    if n['props'].get('background'):v.set(f'{{{A}}}background',n['props']['background'])
    for c in n['children']:
        p=c['props'];cl=c['layout'];kind=c['type']
        if kind=='Guideline':
            child=ET.Element('androidx.constraintlayout.widget.Guideline',{f'{{{A}}}id':'@+id/'+c['id'],f'{{{A}}}layout_width':'wrap_content',f'{{{A}}}layout_height':'wrap_content',f'{{{A}}}orientation':p['orientation'],f'{{{APP}}}layout_constraintGuide_percent':str(p['percent'])})
        elif kind=='Barrier':
            child=ET.Element('androidx.constraintlayout.widget.Barrier',{f'{{{A}}}id':'@+id/'+c['id'],f'{{{A}}}layout_width':'wrap_content',f'{{{A}}}layout_height':'wrap_content',f'{{{APP}}}barrierDirection':p['direction'],f'{{{APP}}}barrierMargin':f'{p["barrierMargin"]}dp',f'{{{APP}}}constraint_referenced_ids':','.join(p['references'].split())})
        else:
            child=generator.view(c,'ConstraintLayout')
            for anchor,link in cl['constraints'].items():
                target='parent' if link['target']=='parent' else '@id/'+link['target']
                child.set(f'{{{APP}}}layout_constraint{anchor.title()}_to{link["anchor"].title()}Of',target)
                child.set(f'{{{A}}}layout_margin{anchor.title()}',f'{link["margin"]}dp') if anchor!='baseline' else None
            for axis,first,last in [('width','start','end'),('height','top','bottom')]:
                if cl[axis]=='fill':child.set(f'{{{A}}}layout_{axis}','0dp' if first in cl['constraints'] and last in cl['constraints'] else 'wrap_content')
                if first not in cl['constraints'] and last not in cl['constraints'] and not (axis=='height' and 'baseline' in cl['constraints']):
                    child.set(f'{{{APP}}}layout_constraint{first.title()}_to{first.title()}Of','parent');child.set(f'{{{A}}}layout_margin{first.title()}',f'{cl["x" if axis=="width" else "y"]}dp')
                if cl[axis]=='fill':
                    child.set(f'{{{APP}}}layout_constraint{axis.title()}_min',f'{cl["min"+axis.title()]}dp');child.set(f'{{{APP}}}layout_constraint{axis.title()}_max',f'{cl["max"+axis.title()]}dp')
            child.set(f'{{{APP}}}layout_constraintHorizontal_bias',str(cl['horizontalBias']));child.set(f'{{{APP}}}layout_constraintVertical_bias',str(cl['verticalBias']))
            if cl['aspectRatio']:child.set(f'{{{APP}}}layout_constraintDimensionRatio',str(cl['aspectRatio']))
        v.append(child)
    return v
