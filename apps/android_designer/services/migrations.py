"""Additive migration boundary: existing sketch layers remain untouched."""
from copy import deepcopy
from apps.android_designer.domain.model import new_document, validate


def interface_from_project(project):
    if project.get('interface_document') is not None:
        return validate(project['interface_document'])
    document=new_document()
    document['app_name']=str(project.get('name') or 'Agata App')[:80]
    document['legacy_source']={'project_id':project['id'],'preserved_screens':len(project.get('screens',[])),
        'note':'Desenhos e camadas existentes permanecem no editor de desenho. Não são convertidos automaticamente em componentes Android.'}
    return document
