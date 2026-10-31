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
            project['interface_document']=clean;project['interface_revision']=current+1
            project['updated_at']=datetime.now(timezone.utc).isoformat(timespec='seconds')
            self.repository.save(project)
            return {'ok':True,'revision':current+1}
