"""Editable template gallery. Authentication is explicitly a local demonstration."""
from .model import new_document,new_screen,new_node,validate
from .tutorial_project import tutorial_document
TEMPLATES={'authentication':'Autenticação Material 3','dashboard':'Dashboard','sidebar':'Sidebar / regiões','bars':'TopBar + BottomBar','profile':'Perfil','settings':'Configurações','form':'Formulário','catalog':'Catálogo','list-detail':'Lista / Detalhes','tasks':'Tarefas'}


def template_document(key):
    if key=='android-tutorial':return tutorial_document()
    if key not in TEMPLATES:raise ValueError('Template inexistente.')
    d=new_document();d['app_name']=TEMPLATES[key];first=d['screens'][0]
    def label(text,size=18):return new_node('TextLabel',{'text':text,'fontSize':size})
    def button(text,target,validation=None):
        b=new_node('Button');b['children'][-1]['props']['text']=text;b['events']={'onClick':{'action':'navigate','target':target}}
        if validation:b['events']['onClick']['validation']=validation
        return b
    if key=='authentication':
        names=['Boas-vindas','Login','Cadastro','Recuperar senha','Dashboard','Perfil','Configurações'];d['screens']=[new_screen(name,80+i*470,80) for i,name in enumerate(names)];d['start_screen']=d['screens'][0]['id'];by={s['name']:s for s in d['screens']}
        for s in d['screens']:s['root']['children']=[new_node('TopBar'),label('Demonstração local — sem autenticação de servidor',12),label(s['name'],26)]
        by['Boas-vindas']['root']['children'] += [button('Entrar',by['Login']['id']),button('Criar conta',by['Cadastro']['id'])]
        for name in ['Login','Cadastro','Recuperar senha']:
            s=by[name];email=new_node('TextField',{'label':'E-mail','keyboard':'email'});s['root']['children'].append(email);rules=[{'field':email['id'],'type':'email'}]
            if name!='Recuperar senha':
                password=new_node('TextField',{'label':'Senha','keyboard':'password'});s['root']['children'].append(password);rules.append({'field':password['id'],'type':'password'})
            s['root']['children'] += [button('Continuar (demonstração)',by['Dashboard']['id'],rules),button('Voltar ao início',by['Boas-vindas']['id'])]
        by['Login']['root']['children'] += [button('Esqueci minha senha',by['Recuperar senha']['id'])]
        by['Dashboard']['root']['children'] += [new_node('Chart'),button('Perfil',by['Perfil']['id']),button('Configurações',by['Configurações']['id'])]
        by['Perfil']['root']['children'] += [new_node('Avatar'),new_node('TextField',{'label':'Nome'}),button('Dashboard',by['Dashboard']['id'])]
        by['Configurações']['root']['children'] += [label('Notificações'),new_node('Switch'),button('Dashboard',by['Dashboard']['id'])]
    else:
        first['name']=TEMPLATES[key];first['root']['children']=[new_node('TopBar'),label(TEMPLATES[key],26)]
        if key in {'dashboard','catalog'}:first['root']['children'] += [new_node('Chart'),new_node('Card'),new_node('Chip')]
        elif key=='sidebar':
            region=new_node('Region');region['name']='Menu lateral editável';region['children']=[new_node('NavigationItem'),new_node('Divider'),new_node('Button')];first['root']['children'].append(region)
        elif key=='bars':first['root']['children'] += [new_node('Card'),new_node('BottomBar')]
        elif key=='profile':first['root']['children'] += [new_node('Avatar'),new_node('TextField',{'label':'Nome'}),new_node('TextField',{'label':'Biografia'})]
        elif key=='settings':first['root']['children'] += [label('Notificações'),new_node('Switch'),label('Privacidade'),new_node('Checkbox')]
        elif key=='form':first['root']['children'] += [new_node('TextField',{'label':'Nome'}),new_node('TextField',{'label':'E-mail','keyboard':'email'}),new_node('Button')]
        elif key=='tasks':first['root']['children'] += [new_node('Checkbox'),label('Minha primeira tarefa'),new_node('TextField',{'label':'Nova tarefa'})]
        elif key=='list-detail':
            detail=new_screen('Detalhes',550,80);detail['root']['children']=[label('Detalhes',26),new_node('Card')];back=new_node('Button');back['events']={'onClick':{'action':'back'}};detail['root']['children'].append(back);d['screens'].append(detail);first['root']['children'] += [button('Abrir detalhes',detail['id'])]
        extra=new_screen('Próxima tela',80+len(d['screens'])*470,80);extra['root']['children']=[label('Continue seu projeto',26)];back=new_node('Button');back['events']={'onClick':{'action':'back'}};extra['root']['children'].append(back);d['screens'].append(extra);first['root']['children'].append(button('Continuar',extra['id']))
    return validate(d)
