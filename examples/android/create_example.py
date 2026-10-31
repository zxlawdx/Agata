"""Reproduce the two-screen semantic example and both source projects."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import json
from apps.android_designer.domain.model import new_document,new_screen,new_node,validate
from apps.android_designer.exporters.project import generate


def example():
    doc=new_document();first=doc['screens'][0];second=new_screen('Dashboard',560,80);doc['screens'].append(second)
    top=new_node('TopBar');card=new_node('Card');field=new_node('TextField');button=new_node('Button');bottom=new_node('BottomBar')
    button['children'][1]['props']['text']='Entrar';button['events']['onClick']={'action':'navigate','target':second['id']}
    card['children'][0]['props']['text']='Bem-vindo';card['children'][1]['props']['text']='Entre com seu e-mail para continuar.'
    bottom['children'][1]['children'][1]['props']['text']='Dashboard';bottom['children'][1]['events']['onClick']={'action':'navigate','target':second['id']}
    first['root']['children']=[top,card,field,button,bottom]
    back=new_node('Button');back['children'][1]['props']['text']='Voltar';back['events']['onClick']={'action':'back'}
    second['root']['children']=[new_node('TextLabel',{'text':'Dashboard','fontSize':24,'bold':True}),back]
    # Stable golden IDs make regenerated examples reviewable.
    ids={};count=0
    from apps.android_designer.domain.model import walk
    for i,s in enumerate(doc['screens']):
        ids[s['id']]=f's_screen_{i}';s['id']=ids[s['id']]
        for n in walk(s['root']):count+=1;n['id']=f'n_component_{count}'
    doc['start_screen']=ids[doc['start_screen']]
    for s in doc['screens']:
        for n in walk(s['root']):
            if n['events'].get('onClick',{}).get('target') in ids:n['events']['onClick']['target']=ids[n['events']['onClick']['target']]
    return validate(doc)


if __name__=='__main__':
    root=Path(__file__).resolve().parent;doc=example()
    (root/'login-dashboard.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    for backend in ['compose','xml']:
        for path,content in generate(doc,backend).items():
            file=root/backend/path;file.parent.mkdir(parents=True,exist_ok=True)
            file.write_bytes(content if isinstance(content,bytes) else content.encode())
