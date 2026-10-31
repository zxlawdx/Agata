"""Regenerate deterministic tutorial IR, without touching user projects."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from apps.android_designer.domain.tutorial_project import tutorial_document
from apps.android_designer.domain.model import walk,validate


def example():
    d=tutorial_document();mapping={};counter=0
    for i,s in enumerate(d['screens']):
        mapping[s['id']]=f's_tutorial_{i}';s['id']=mapping[s['id']]
        for n in walk(s['root']):
            counter+=1;mapping[n['id']]=f'n_tutorial_{counter}';n['id']=mapping[n['id']]
    d['start_screen']=mapping[d['start_screen']]
    for s in d['screens']:
        for l in s['layers']:l['nodes']=[mapping[n] for n in l['nodes']]
        for n in walk(s['root']):
            for link in n['layout']['constraints'].values():link['target']=mapping.get(link['target'],link['target'])
            if n['type']=='Barrier':n['props']['references']=' '.join(mapping[x] for x in n['props']['references'].split())
            e=n['events'].get('onClick',{})
            if 'target' in e:e['target']=mapping[e['target']]
    return validate(d)


if __name__=='__main__':(Path(__file__).parent/'tutorial-app.json').write_text(json.dumps(example(),ensure_ascii=False,indent=2)+'\n')
