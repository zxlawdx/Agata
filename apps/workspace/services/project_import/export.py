"""Export a copy, keeping original source/configuration and explicit conflicts.
Only the optional activation changes the copied launch manifest/dependency additions.
"""
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile,ZipInfo,ZIP_DEFLATED
from datetime import datetime,timezone
from uuid import uuid4
import json
from .scanner import safe_name
from apps.android_designer.exporters.project import generate
A='http://schemas.android.com/apk/res/android'


def imported_export(repo,project_id,backend,activate=False,root=None):
    project=repo.get(project_id);doc=project['interface_document'];meta=project['source_import'];base=repo._read_path(project_id).parent
    originals={p:(base/'original-source'/safe_name(p)).read_bytes() for p in meta['files']}
    sources={p:(base/'source-edits'/p).read_bytes() if (base/'source-edits'/p).is_file() else content for p,content in originals.items()}
    from .source_patch import patch_sources
    sources,patch_conflicts=patch_sources(doc,sources)
    generated=generate(doc,backend);warnings=[];conflicts=[]
    if patch_conflicts:warnings.append({'message':'Edições visuais sem patch seguro da fonte: '+', '.join(patch_conflicts)+'. Revise a Activity gerada e os originais.'})
    if meta['framework']!=backend or not any(p.endswith(('build.gradle','build.gradle.kts')) for p in sources):
        output=dict(generated);warnings.append({'message':'Backend alternativo: projeto Agata separado; originais preservados em agata-original.'})
    elif meta['kind'] in {'agata','agata-project'}:
        output=dict(sources)
        for path,content in generated.items():
            if path not in sources or path in meta['managed_files'] and not (base/'source-edits'/path).exists():output[path]=content
            elif sources[path]!=(content.encode() if isinstance(content,str) else content):conflicts.append(path);output['agata-generated-conflicts/'+path]=content
    else:
        output=dict(sources)
        manifest_path=next((p for p in sources if p.endswith('/src/main/AndroidManifest.xml')),'app/src/main/AndroidManifest.xml');module=manifest_path.split('/src/')[0]
        for path,content in generated.items():
            if not path.startswith('app/src/main/'):continue
            dest=module+path[3:]
            if path.endswith('MainActivity.kt'):
                dest=dest.removesuffix('MainActivity.kt')+'AgataImportedActivity.kt';content=content.replace('class MainActivity','class AgataImportedActivity')
            if path.endswith('AndroidManifest.xml'):continue
            if dest in sources:
                if '/res/values/' in dest:
                    try:
                        old=ET.fromstring(sources[dest]);new=ET.fromstring(content);names={(c.tag,c.get('name')) for c in old}
                        for child in new:
                            if (child.tag,child.get('name')) not in names:old.append(child)
                        output[dest]=ET.tostring(old,encoding='unicode')+'\n'
                    except ET.ParseError:conflicts.append(dest);output['agata-generated-conflicts/'+dest]=content
                elif sources[dest]!=(content.encode() if isinstance(content,str) else content):conflicts.append(dest);output['agata-generated-conflicts/'+dest]=content
            else:output[dest]=content
        if manifest_path in sources:
            manifest=ET.fromstring(sources[manifest_path]);app=manifest.find('application')
            if app is not None:
                activity=ET.SubElement(app,'activity',{f'{{{A}}}name':doc['namespace']+'.AgataImportedActivity',f'{{{A}}}exported':'true',f'{{{A}}}theme':'@style/Theme.Agata' if backend=='xml' else '@android:style/Theme.Material.Light.NoActionBar'})
                if activate:
                    for existing in list(app):
                        if existing is activity:continue
                        for item in list(existing):
                            if item.tag=='intent-filter' and any(c.get(f'{{{A}}}name')=='android.intent.category.LAUNCHER' for c in item):existing.remove(item)
                    intent=ET.SubElement(activity,'intent-filter');ET.SubElement(intent,'action',{f'{{{A}}}name':'android.intent.action.MAIN'});ET.SubElement(intent,'category',{f'{{{A}}}name':'android.intent.category.LAUNCHER'})
                output[manifest_path]=ET.tostring(manifest,encoding='unicode')+'\n'
        if activate:
            gradle=next((p for p in (module+'/build.gradle.kts',module+'/build.gradle') if p in sources),None)
            if gradle:
                dependencies=generated['app/build.gradle.kts'].split('dependencies {',1)[1].rsplit('}',1)[0]
                output[gradle]=sources[gradle].decode()+'\n// Agata: dependencies for the explicitly activated generated Activity\ndependencies {\n'+dependencies+'\n}\n'
                warnings.append({'message':'Cópia exportada: dependências adicionais inseridas. Plugins/versões originais preservados; sincronize e compile no Android Studio.'})
            else:warnings.append({'message':'Módulo Gradle não encontrado. Vincule a Activity/dependências manualmente.'})
        else:warnings.append({'message':'MainActivity original preservada. AgataImportedActivity foi adicionada sem substituir o launcher; use Vincular Activity para ativá-la explicitamente.'})
        output['agata-model.json']=generated['agata-model.json']
    for path,content in originals.items():
        output['agata-original/'+path]=content
        if sources[path]!=content:output['agata-source-edits/'+path]=sources[path]
    if conflicts:warnings.append({'message':'Fontes existentes preservadas. Compare agata-generated-conflicts antes de aplicar: '+', '.join(conflicts)})
    output['agata-import-report.json']=json.dumps({'warnings':warnings,'conflicts':conflicts,'originals_preserved':True,'android_build_verified':False},ensure_ascii=False,indent=2)
    target_root=Path(root) if root else Path.home()/'Agata'/'Exports';target_root.mkdir(parents=True,exist_ok=True);target=target_root/('android-import-'+backend+'-'+uuid4().hex[:12]+'.zip')
    with ZipFile(target,'x',ZIP_DEFLATED) as archive:
        for path,content in output.items():
            entry=ZipInfo('AgataExport/'+path);entry.compress_type=ZIP_DEFLATED;entry.external_attr=(0o100755 if path.endswith('gradlew') else 0o100644)<<16;archive.writestr(entry,content)
    return {'ok':True,'path':str(target),'backend':backend,'warnings':warnings,'file_count':len(output),'android_build_verified':False}
