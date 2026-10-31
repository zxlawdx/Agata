"""Editable first-app template; generic regions deliberately avoid Material slot limits."""
from .model import new_document,new_screen,new_node,validate


def tutorial_document():
    d=new_document();d['app_name']='Meu Primeiro Aplicativo Android'
    home=d['screens'][0];home['name']='Tela Inicial';home['width']=900
    login=new_screen('Login',1100,80);dashboard=new_screen('Dashboard',1600,80);d['screens'] += [login,dashboard]
    root=new_node('ConstraintLayout');root['layout'].update(width='fill',height='fill',padding=0);home['root']=root
    def link(n,anchor,target='parent',edge=None,margin=0):n['layout']['constraints'][anchor]={'target':target,'anchor':edge or anchor,'margin':margin}
    def region(name,width,height,anchors):
        n=new_node('Region');n['name']=name;n['layout'].update(width=width,height=height,padding=12,gap=8);root['children'].append(n)
        for anchor,target,edge in anchors:link(n,anchor,target,edge)
        return n
    top=region('Top Bar','fill',72,[('start','parent','start'),('end','parent','end'),('top','parent','top')]);top['props'].update(background='#D8F6FA',orientation='horizontal');top['layout']['padding']=8
    title=new_node('TextLabel',{'text':'Meu Primeiro Aplicativo Android'});title['props']['fontSize']=18;title['layout']['width']=200;top['children']=[title]
    action=new_node('IconButton');action['events']={'onClick':{'action':'navigate','target':login['id']}};top['children'].append(action)
    bottom=region('Bottom Bar','fill',64,[('start','parent','start'),('end','parent','end'),('bottom','parent','bottom')]);bottom['props']['orientation']='horizontal';bottom['children']=[new_node('NavigationItem')];bottom['props']['background']='#FFE6A7'
    left=region('Lateral esquerda',160,'fill',[('start','parent','start'),('top',top['id'],'bottom'),('bottom',bottom['id'],'top')]);left['children']=[new_node('TextLabel',{'text':'Navegação'}),new_node('NavigationItem')];left['props']['background']='#F6E9FF';left['children'][-1]['events']={'onClick':{'action':'navigate','target':dashboard['id']}};left['layout']['responsive']={'compact':{'visible':False}}
    right=region('Lateral direita',180,'fill',[('end','parent','end'),('top',top['id'],'bottom'),('bottom',bottom['id'],'top')]);right['children']=[new_node('Card')];right['layout']['responsive']={'compact':{'visible':False},'medium':{'visible':False}}
    guide=new_node('Guideline',{'orientation':'vertical','percent':.5});guide['name']='Centro 50%';root['children'].append(guide)
    center=region('Conteúdo central','fill','fill',[('start','parent','start'),('end','parent','end'),('top',top['id'],'bottom'),('bottom',bottom['id'],'top')]);center['layout']['constraints']['start']['margin']=170;center['layout']['constraints']['end']['margin']=190
    # Responsive padding changes without references to GONE side panels.
    center['layout']['constraints']['start']['margin']=0;center['layout']['constraints']['end']['margin']=0
    center['layout'].update(maxWidth=500);center['layout']['responsive']={'compact':{'maxWidth':340},'medium':{'maxWidth':400}}
    center['children']=[new_node('Card'),new_node('TextLabel',{'text':'Selecione o botão flutuante e ative Constraints. Ele permanece centralizado ao redimensionar.'})]
    button=new_node('Button');button['name']='Abrir Login';button['children'][1]['props']['text']='Abrir Login';button['layout'].update(width=160,height=48)
    for a in ('start','end','top','bottom'):link(button,a)
    button['events']={'onClick':{'action':'navigate','target':login['id']}};root['children'].append(button)
    for s in (login,dashboard):s['root']['children']=[new_node('TopBar'),new_node('Card')]
    login['root']['children'] += [new_node('TextField',{'label':'E-mail'}),new_node('TextField',{'label':'Senha','keyboard':'password'})]
    enter=new_node('Button');enter['children'][1]['props']['text']='Entrar';enter['events']={'onClick':{'action':'navigate','target':dashboard['id']}};login['root']['children'].append(enter)
    back=new_node('Button');back['children'][1]['props']['text']='Voltar';back['events']={'onClick':{'action':'back'}};dashboard['root']['children'].append(back)
    home['layers']=[{'id':'l_navigation','name':'Navegação','nodes':[top['id'],bottom['id'],left['id'],right['id']],'visible':True,'locked':False,'opacity':1},{'id':'l_content','name':'Conteúdo','nodes':[center['id']],'visible':True,'locked':False,'opacity':1},{'id':'l_floating','name':'Flutuantes','nodes':[button['id']],'visible':True,'locked':False,'opacity':1}]
    d['tutorial_template']=True
    return validate(d)
