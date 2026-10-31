"""UI persistence is independent of the sketch layer serialization."""
from datetime import datetime, timezone
from threading import RLock
from apps.android_designer.domain.model import validate
from apps.android_designer.services.migrations import interface_from_project

_LOCK=RLock()


class InterfaceService:
    def __init__(self, repository):self.repository=repository

    def get(self, project_id):
        project=self.repository.get(project_id)
        return {'document':interface_from_project(project),'revision':project.get('interface_revision',0)}

    def save(self, project_id, document, revision):
        clean=validate(document)
        with _LOCK:
            project=self.repository.get(project_id)
            current=project.get('interface_revision',0)
            if type(revision) is not int or revision!=current:
                raise ValueError('O modelo foi alterado em outra janela. Reabra antes de salvar.')
            if project.get('source_import') and project.get('interface_document'):
                from pathlib import Path
                from uuid import uuid4
                import json
                backup=self.repository._read_path(project_id).parent/'model-history'/(uuid4().hex+'.json');backup.parent.mkdir(parents=True,exist_ok=True);backup.write_text(json.dumps(project['interface_document'],ensure_ascii=False),encoding='utf-8')
            if 'android_settings' in clean:
                clean['android_settings'].update(namespace=clean['namespace'],theme=clean['theme']['darkMode'])
                project['project_settings']=clean['android_settings']
            project['interface_document']=clean;project['interface_revision']=current+1
            project['updated_at']=datetime.now(timezone.utc).isoformat(timespec='seconds')
            self.repository.save(project)
            return {'ok':True,'revision':current+1}
