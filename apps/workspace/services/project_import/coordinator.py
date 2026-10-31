"""Two-phase import with immutable source snapshots and explicit source reanalysis."""
from pathlib import Path
from uuid import uuid4
from datetime import datetime,timezone
import json,base64,shutil,hashlib,re,io
from zipfile import ZipFile,ZIP_DEFLATED
from .scanner import snapshot,text_files,safe_name,MAX_ARCHIVE,MAX_FILE
from .resources import resolve_resources
from .compose import ComposeParser
from apps.android_designer.domain.model import new_document,validate,walk
from apps.workspace.services.projects import ProjectService
from apps.workspace.services.manager import ProjectManager


class ImportCoordinator:
    def __init__(self,repository):self.repo=repository;self.staging=repository.root/'import-staging'
    def _stage(self,token):
        if not isinstance(token,str) or not re.fullmatch(r'[0-9a-f]{32}',token):raise ValueError('Token de importação inválido.')
        p=self.staging/token
        if not p.is_dir():raise ValueError('Prévia expirada ou cancelada. Analise novamente.')
        return p
    def analyze(self,path=None,files=None):
        source=Path(path).expanduser() if path else None;files=snapshot(source) if files is None else files
        texts=text_files(files);resources,warnings=resolve_resources(files);native=None;native_project=None;settings={};kind='unknown';parser=None
        if 'agata-model.json' in texts:
            try:native=validate(json.loads(texts['agata-model.json']));kind='agata'
            except (ValueError,TypeError,KeyError) as exc:raise ValueError('Modelo Agata inválido: '+str(exc)) from exc
        elif 'project.json' in texts:
            try:
                native_project=json.loads(texts['project.json']);native=native_project.get('interface_document')
                if native is not None:native=validate(native)
                kind='agata-project'
            except (ValueError,TypeError,KeyError) as exc:raise ValueError('project.json inválido.') from exc
        gradle=any(k.endswith(('build.gradle','build.gradle.kts')) for k in files);manifest=any(k.endswith('AndroidManifest.xml') for k in files)
        if native_project is not None and native is None and not isinstance(native_project.get('screens'),list):raise ValueError('project.json incompleto: faltam telas ou modelo Agata válido.')
        if native is not None:doc=native
        elif any(k.endswith('.kt') for k in files):
            parser=ComposeParser(texts,resources);doc=parser.parse();warnings+=parser.warnings;kind='compose' if doc['screens'] else 'android-empty' if gradle or manifest else 'kotlin-code-only'
        elif gradle or manifest:doc=new_document();doc.update(screens=[],start_screen='',import_empty=True);kind='android-empty'
        elif native_project is not None:
            from apps.android_designer.services.migrations import interface_from_project
            doc=interface_from_project(native_project)
        elif not files and source and source.is_dir():doc=new_document();kind='empty-folder'
        else:raise ValueError('Não foi encontrada estrutura Android, Kotlin ou projeto Agata válido.')
        # Read literal Gradle metadata only; never evaluate DSL, scripts, version catalogs or plugins.
        for p,t in texts.items():
            if p.endswith(('build.gradle.kts','build.gradle')):
                m=re.search(r'namespace\s*(?:=\s*|\s+)["\']([a-zA-Z0-9_.]+)["\']',t)
                if m:doc['namespace']=m[1]
                for key,name in [('minSdk','min_sdk'),('targetSdk','target_sdk')]:
                    m=re.search(key+r'(?:Version)?\s*(?:=\s*|\s+)(\d+)',t)
                    if m:settings[name]=int(m[1])
        doc=validate(doc);settings={'namespace':doc['namespace'],'ui_framework':'compose' if any('@Composable' in t or 'androidx.compose' in t or re.search(r'compose\s*=\s*true',t) for t in texts.values()) else 'xml',**settings}
        component_count=sum(1 for s in doc['screens'] for n in walk(s['root']))
        baseline={};conflicts=[]
        if native is not None and doc['screens']:
            from apps.android_designer.exporters.project import generate
            for backend in ('compose','xml'):
                try:
                    generated=generate(doc,backend)
                    matches=[p for p in generated if p in files and isinstance(generated[p],str) and files[p].decode('utf-8',errors='replace')==generated[p]]
                    if len(matches)>len(baseline):baseline={p:hashlib.sha256(files[p]).hexdigest() for p in matches};settings['ui_framework']=backend
                except ValueError:pass
            for p in texts:
                if p.endswith('.kt') and p not in baseline:conflicts.append(p)
            if conflicts:warnings.append({'path':'source','message':'Arquivos Kotlin diferentes da geração original serão preservados; revise conflitos antes de substituir: '+', '.join(conflicts[:8])})
        counts=parser.counts if parser else {'fully_editable':component_count,'partially_editable':0,'code_only':len(conflicts)}
        doc['import_summary']={'kind':kind,'source_files':sorted(files),'resources':resources['paths'],'warnings':warnings,'classification':counts,'provenance':parser.provenance if parser else {},'empty':not doc['screens']}
        token=uuid4().hex;stage=self.staging/token;stage.mkdir(parents=True)
        for name,data in files.items():p=stage/'files'/safe_name(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        result={'token':token,'name':native_project.get('name','Projeto importado') if native_project else source.stem if source else doc['app_name'],'kind':kind,'framework':settings['ui_framework'],'screen_count':len(doc['screens']),'component_count':component_count,'resource_count':len(resources['paths']),'classification':counts,'warnings':warnings,'files':sorted(files),'screen_candidates':doc.get('compose_project',{}).get('screen_candidates',[]),'reusable_components':[v for v in doc.get('compose_project',{}).get('definitions',{}).values() if v['kind']=='Reusable Component'],'requires_initialization':kind=='empty-folder','empty':not doc['screens']}
        metadata={'preview':result,'document':doc,'settings':settings,'managed_files':baseline,'conflicts':conflicts,'original_path':str(source.absolute()) if source else None,'sketch_screens':native_project.get('screens') if native_project else None}
        (stage/'analysis.json').write_text(json.dumps(metadata,ensure_ascii=False),encoding='utf-8');return result
    def upload(self,name,encoded):
        if not isinstance(encoded,str) or len(encoded)>MAX_ARCHIVE*4//3+8:raise ValueError('Arquivo excede 30 MB.')
        try:data=base64.b64decode(encoded,validate=True)
        except (ValueError,TypeError) as exc:raise ValueError('Upload inválido.') from exc
        self.staging.mkdir(parents=True,exist_ok=True);temporary=self.staging/(uuid4().hex+Path(name).suffix.lower())
        try:
            temporary.write_bytes(data);preview=self.analyze(files={safe_name(Path(name).name):data}) if Path(name).suffix.lower() in {'.kt','.json'} else self.analyze(temporary)
            preview['name']=Path(name).stem or 'Projeto importado'
            stage=self._stage(preview['token']);meta=json.loads((stage/'analysis.json').read_text());meta['preview']=preview;meta['original_path']=None
            (stage/'analysis.json').write_text(json.dumps(meta,ensure_ascii=False),encoding='utf-8');return preview
        finally:temporary.unlink(missing_ok=True)
    def upload_sources(self, entries):
        if not isinstance(entries,list) or not 1<=len(entries)<=200:raise ValueError('Selecione até 200 arquivos Kotlin.')
        files={};total=0
        for entry in entries:
            name=safe_name(entry['name'])
            if not name.endswith('.kt') or name.casefold() in {p.casefold() for p in files}:raise ValueError('Arquivos Kotlin inválidos ou duplicados.')
            encoded=entry['data']
            if not isinstance(encoded,str) or len(encoded)>MAX_FILE*4//3+8:raise ValueError('Fonte excede 8 MB.')
            try:data=base64.b64decode(encoded,validate=True)
            except ValueError as exc:raise ValueError('Upload inválido.') from exc
            total+=len(data)
            if len(data)>MAX_FILE or total>MAX_ARCHIVE:raise ValueError('Limite total de fontes: 30 MB.')
            files[name]=data
        return self.analyze(files=files)

    def confirm(self,token,name=None,initialize=False,screen_ids=None):
        stage=self._stage(token);meta=json.loads((stage/'analysis.json').read_text());preview=meta['preview']
        if preview['requires_initialization'] and not initialize:raise ValueError('Confirme explicitamente a inicialização da pasta vazia.')
        if screen_ids is not None:
            if not isinstance(screen_ids,list) or not screen_ids or set(screen_ids)-{s['id'] for s in meta['document']['screens']}:raise ValueError('Selecione ao menos uma Screen válida.')
            meta['document']['screens']=[s for s in meta['document']['screens'] if s['id'] in screen_ids]
            if meta['document']['start_screen'] not in screen_ids:meta['document']['start_screen']=screen_ids[0]
            for screen in meta['document']['screens']:
                for node in walk(screen['root']):
                    event=node['events'].get('onClick')
                    if event and event.get('action')=='navigate' and event['target'] not in screen_ids:event['broken']=True
        payload={'name':name or preview['name'],'platform':'android'}
        if preview['requires_initialization']:payload.update(location=meta['original_path'],settings=meta['settings'])
        registry_before=self.repo._registry()
        p=ProjectService(self.repo).create_project(payload);p['interface_document']=meta['document'];p['interface_document']['app_name']=p['name'];p['interface_revision']=0;p['project_settings']=meta['settings'];p['source_import']={k:meta[k] for k in ['managed_files','conflicts','original_path']};p['source_import'].update(kind=preview['kind'],files=preview['files'],framework=preview['framework']);p['preferred_editor']='android'
        if meta.get('sketch_screens'):p['screens']=meta['sketch_screens']
        destination=self.repo._read_path(p['id'])
        try:
            if (stage/'files').exists():shutil.copytree(stage/'files',destination.parent/'original-source')
            self.repo.save(p)
        except (OSError,ValueError):
            if preview['requires_initialization']:destination.unlink(missing_ok=True)
            else:shutil.rmtree(destination.parent,ignore_errors=True)
            self.repo._save_registry(registry_before)
            raise
        self.cancel(token);return ProjectManager(self.repo).describe(p)
    def cancel(self,token):shutil.rmtree(self._stage(token));return {'ok':True}
    def source(self,project_id,path):
        p=self.repo.get(project_id);path=safe_name(path)
        if path not in p.get('source_import',{}).get('files',[]):raise ValueError('Arquivo não pertence ao projeto.')
        root=self.repo._read_path(project_id).parent;target=root/'source-edits'/path
        if not target.is_file():target=root/'original-source'/path
        data=target.read_bytes()
        if len(data)>MAX_FILE:raise ValueError('Arquivo grande demais.')
        try:text=data.decode('utf-8')
        except UnicodeDecodeError:return {'path':path,'binary':True,'size':len(data)}
        return {'path':path,'content':text,'binary':False,'customized':(root/'source-edits'/path).exists(),'sha256':hashlib.sha256(data).hexdigest()}
    def save_source(self,project_id,path,content,expected_sha):
        current=self.source(project_id,path)
        if current.get('binary') or current['sha256']!=expected_sha:raise ValueError('Arquivo alterado em outra janela; reabra antes de salvar.')
        if not isinstance(content,str) or len(content.encode())>MAX_FILE:raise ValueError('Conteúdo de fonte inválido.')
        root=self.repo._read_path(project_id).parent;target=root/'source-edits'/safe_name(path);target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists():
            backup=root/'source-history'/(uuid4().hex+'-'+Path(path).name);backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,backup)
        target.write_text(content,encoding='utf-8');return self.source(project_id,path)
    def reanalyze(self,project_id):
        p=self.repo.get(project_id);root=self.repo._read_path(project_id).parent;files={name:(root/'source-edits'/name if (root/'source-edits'/name).is_file() else root/'original-source'/name).read_bytes() for name in p['source_import']['files']}
        # Reanalysis of code must not silently prefer the stale exported IR.
        files.pop('agata-model.json',None);files.pop('project.json',None)
        preview=self.analyze(files=files);meta=json.loads((self._stage(preview['token'])/'analysis.json').read_text());preview['document']=meta['document'];return preview
