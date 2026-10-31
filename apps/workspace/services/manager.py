"""Persistent project locations/recents. Removing a recent never deletes a project."""
import copy,json,os,re,shutil,subprocess,sys
from pathlib import Path
from datetime import datetime,timezone
from uuid import uuid4


def stamp():return datetime.now(timezone.utc).isoformat(timespec='seconds')


class ProjectManager:
    def __init__(self,repository):self.repo=repository
    def open(self,path):
        p=Path(path).expanduser();p=p/'project.json' if p.is_dir() else p
        if p.is_symlink() or not p.is_file():raise ValueError('Selecione project.json de um projeto Agata existente.')
        data=json.loads(p.read_text(encoding='utf-8'))
        if not isinstance(data,dict) or not re.fullmatch(r'[0-9a-f]{32}',str(data.get('id',''))):raise ValueError('Projeto Agata inválido.')
        if not isinstance(data.get('name'),str) or not isinstance(data.get('screens'),list):raise ValueError('Estrutura de projeto incompleta.')
        if data.get('interface_document'):
            from apps.android_designer.domain.model import validate
            validate(data['interface_document'])
        self.repo.register(data['id'],p,data['name']);return self.describe(self.repo.get(data['id']))
    def describe(self,project):
        p=copy.deepcopy(project);p['location']=str(self.repo._read_path(p['id']).parent);p['unavailable']=False
        p['open_editor']='android' if 'interface_document' in p or p.get('project_settings',{}).get('ui_framework') else 'sketch'
        p['framework']=p.get('project_settings',{}).get('ui_framework','compose' if p.get('interface_document') else 'sketch')
        return p
    def list(self,include_hidden=False):
        registry=self.repo._registry();projects={p['id']:self.describe(p) for p in self.repo.list()}
        for key,entry in registry.items():
            if key not in projects:projects[key]={'id':key,'name':entry.get('name','Projeto indisponível'),'canvas':{'width':390,'height':844},'updated_at':entry.get('opened_at',''),'location':str(Path(entry['path']).parent),'unavailable':True,'open_editor':'android','framework':'unknown'}
        return sorted((p for key,p in projects.items() if include_hidden or not registry.get(key,{}).get('hidden')),key=lambda p:registry.get(p['id'],{}).get('opened_at',p.get('updated_at','')),reverse=True)
    def action(self,project_id,action,value=None):
        if action=='remove_recent':
            data=self.repo._registry();entry=data.get(project_id)
            if entry is None:entry={'path':str(self.repo._read_path(project_id)),'name':self.repo.get(project_id)['name']};data[project_id]=entry
            entry['hidden']=True;self.repo._save_registry(data);return {'ok':True}
        p=self.repo.get(project_id)
        if action=='rename':
            if not isinstance(value,str) or not value.strip() or len(value)>80 or re.search(r'[\x00-\x1f]',value):raise ValueError('Nome inválido.')
            p['name']=value.strip()
            if p.get('interface_document'):
                p['interface_document']['app_name']=p['name'];p['interface_revision']=p.get('interface_revision',0)+1
            p['updated_at']=stamp();self.repo.save(p);self.repo.register(project_id,self.repo._read_path(project_id),p['name'])
        elif action=='duplicate':
            original=p['id'];p=copy.deepcopy(p);p['id']=uuid4().hex;p['name']+=' cópia';p['created_at']=p['updated_at']=stamp();self.repo.save(p)
            for folder in ['original-source','source-edits']:
                source=self.repo._read_path(original).parent/folder
                if source.is_dir():shutil.copytree(source,self.repo._read_path(p['id']).parent/folder,symlinks=False)
            self.repo.register(p['id'],self.repo._read_path(p['id']),p['name'])
        elif action=='open_folder':
            folder=str(self.repo._read_path(project_id).parent)
            if sys.platform=='win32':os.startfile(folder)
            else:subprocess.Popen(['open' if sys.platform=='darwin' else 'xdg-open',folder],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            return {'ok':True,'path':folder}
        elif action=='settings':
            from .settings import validate_settings
            settings=validate_settings(value)
            p['project_settings']=settings
            if p.get('interface_document'):
                p['interface_document']['namespace']=settings['namespace'];p['interface_document']['theme']['darkMode']=settings['theme'];p['interface_document']['android_settings']=settings
                from apps.android_designer.domain.model import validate
                validate(p['interface_document'])
                p['interface_revision']=p.get('interface_revision',0)+1
            self.repo.save(p)
        elif action=='touch':self.repo.register(project_id,self.repo._read_path(project_id),p['name'])
        else:raise ValueError('Operação de projeto inválida.')
        return self.describe(p)
