from pathlib import Path


def validate_settings(payload=None):
    from apps.android_designer.domain.model import NAMESPACE,KEYWORDS
    p={'namespace':'com.example.agata','min_sdk':24,'target_sdk':36,'ui_framework':'compose','theme':'system','orientation':'unspecified',**(payload or {})}
    if set(p)-{'namespace','min_sdk','target_sdk','ui_framework','theme','orientation'}:raise ValueError('Configuração desconhecida.')
    if not isinstance(p['namespace'],str) or not NAMESPACE.fullmatch(p['namespace']) or any(x in KEYWORDS for x in p['namespace'].split('.')):raise ValueError('Package name inválido.')
    if type(p['min_sdk']) is not int or type(p['target_sdk']) is not int or not 24<=p['min_sdk']<=p['target_sdk']<=36:raise ValueError('SDKs suportados: 24 até 36, mínimo <= alvo.')
    if p['ui_framework'] not in {'compose','xml'} or p['theme'] not in {'light','dark','system'} or p['orientation'] not in {'unspecified','portrait','landscape'}:raise ValueError('Configuração Android inválida.')
    return p


def available_location(value):
    target=Path(value).expanduser()
    if not target.is_absolute():raise ValueError('Escolha um caminho absoluto.')
    if target.is_symlink():raise ValueError('Local não pode ser link simbólico.')
    if target.exists() and (not target.is_dir() or any(target.iterdir())):raise ValueError('Destino já contém arquivos. Escolha uma pasta vazia; nada foi sobrescrito.')
    return target
