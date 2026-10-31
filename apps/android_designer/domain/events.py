"""Structured actions shared by validation and native generators. No user code execution."""
import re
from urllib.parse import urlparse


def validate_event(e,screen_ids):
    if not isinstance(e,dict) or e.get('action') not in {'navigate','back','url','custom'}:raise ValueError('Ação inválida.')
    if set(e)-{'action','target','policy','popUpTo','broken','validation'}:raise ValueError('Campo de evento não suportado.')
    if e['action']=='navigate':
        if e.get('policy','push') not in {'push','replace','popUpTo'}:raise ValueError('Política de navegação inválida.')
        if not isinstance(e.get('target'),str):raise ValueError('Destino inválido.')
        if e['target'] not in screen_ids and e.get('broken') is not True:raise ValueError('Screen de destino inexistente.')
        if e.get('policy')=='popUpTo' and e.get('popUpTo') not in screen_ids and not e.get('broken'):raise ValueError('Screen popUpTo inexistente.')
    rules=e.get('validation',[])
    if not isinstance(rules,list) or len(rules)>20 or any(not isinstance(r,dict) or set(r)!={'field','type'} or not isinstance(r['field'],str) or r['type'] not in {'email','password','required'} for r in rules):raise ValueError('Validação de formulário inválida.')
    if e['action']=='url':
        value=urlparse(e.get('target',''))
        if value.scheme not in {'http','https'} or not value.netloc or len(e['target'])>2048:raise ValueError('URL deve ser HTTP/HTTPS válida.')
    if e['action']=='custom' and not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_.]{0,79}',e.get('target','')):raise ValueError('Use um nome de ação, não código.')


def action_kind(event):
    if event.get('policy')=='popUpTo':return 'popUpTo:'+event['popUpTo']
    if event.get('policy')=='replace':return 'replace'
    return event.get('action','')
