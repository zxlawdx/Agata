"""Two Screens with nested auto/free layouts and width-class overrides."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from apps.android_designer.domain.model import new_document,new_node,new_screen,validate


def example():
 d=new_document();a=d['screens'][0];b=new_screen('Dashboard',560,80);d['screens'].append(b)
 root=a['root'];root['layout'].update(height='fill',scroll='vertical',padding=16)
 title=new_node('TextLabel',{'text':'Uma interface responsiva com textos que podem ocupar várias linhas','fontSize':22})
 field=new_node('TextField');button=new_node('Button');button['children'][1]['props']['text']='Entrar';button['events']['onClick']={'action':'navigate','target':b['id']}
 card=new_node('Card');card['layout'].update(minWidth=200,maxWidth=360)
 row=new_node('Row');row['layout'].update(height=64)
 for weight in [1,2]:
  child=new_node('Button');child['layout'].update(width='fill',weight=weight);child['children'][1]['props']['text']='Peso '+str(weight);row['children'].append(child)
 free=new_node('Box');free['name']='Box livre';free['layout'].update(mode='free',height=220)
 label=new_node('TextLabel',{'text':'Arraste aqui'});label['layout'].update(width=120,height=40,x=16,y=16)
 small=new_node('Button');small['layout'].update(width=140,height=48,x=152,y=80);free['children']=[label,small]
 grid=new_node('Grid');grid['layout']['columns']=1;grid['layout']['responsive']={'medium':{'columns':2},'expanded':{'columns':3}}
 for i in range(3):grid['children'].append(new_node('Card'))
 root['children']=[title,field,button,card,row,free,grid]
 b['root']['children']=[new_node('TextLabel',{'text':'Dashboard'})]
 from apps.android_designer.domain.model import walk
 mapping={};counter=0
 for i,screen in enumerate(d['screens']):
  mapping[screen['id']]=f's_responsive_{i}';screen['id']=mapping[screen['id']]
  for node in walk(screen['root']):counter+=1;node['id']=f'n_responsive_{counter}'
 d['start_screen']=mapping[d['start_screen']]
 for screen in d['screens']:
  for node in walk(screen['root']):
   event=node['events'].get('onClick')
   if event and event.get('target') in mapping:event['target']=mapping[event['target']]
 return validate(d)


if __name__=='__main__':
 d=example();(Path(__file__).parent/'responsive-demo.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
