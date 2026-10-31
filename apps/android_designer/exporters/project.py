"""Build a complete source project; export paths are resolved solely by Python."""
import json
from datetime import datetime,timezone
from pathlib import Path
from uuid import uuid4
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from hashlib import sha256
from apps.android_designer.domain.model import validate, walk
from apps.android_designer.exporters.compose import ComposeGenerator
from apps.android_designer.exporters.xml import XmlGenerator

AGP='8.13.2';KOTLIN='2.2.20';BOM='2025.10.01';NAVIGATION='2.9.5';GRADLE='8.13'


def generate(document,backend='compose'):
    document=validate(document)
    if not document['screens']:raise ValueError('Crie uma primeira Screen antes de gerar o aplicativo.')
    if backend not in {'compose','xml'}:raise ValueError('Exportador Android desconhecido.')
    for s in document['screens']:
        for n in walk(s['root']):
            if n['events'].get('onClick',{}).get('broken'):raise ValueError('Corrija o destino quebrado em '+n['name']+' antes de exportar.')
    files=(ComposeGenerator if backend=='compose' else XmlGenerator)(document).generate()
    namespace=document['namespace']
    settings=document.get('android_settings',{})
    min_sdk=int(settings.get('min_sdk',24));target_sdk=int(settings.get('target_sdk',36))
    if not 24<=min_sdk<=target_sdk<=36:raise ValueError('SDKs incompatíveis com o exportador (24–36).')
    orientation=settings.get('orientation','unspecified')
    if orientation not in {'unspecified','portrait','landscape'}:raise ValueError('Orientação inválida.')
    plugins=f'id("com.android.application") version "{AGP}" apply false\nid("org.jetbrains.kotlin.android") version "{KOTLIN}" apply false\n'
    app_plugins='id("com.android.application")\nid("org.jetbrains.kotlin.android")\n'
    deps=['androidx.core:core-ktx:1.17.0']
    if backend=='compose':
        plugins+=f'id("org.jetbrains.kotlin.plugin.compose") version "{KOTLIN}" apply false\n'
        app_plugins+='id("org.jetbrains.kotlin.plugin.compose")\n'
        deps+=['androidx.constraintlayout:constraintlayout-compose:1.1.2','androidx.activity:activity-compose:1.11.0','androidx.compose.ui:ui','androidx.compose.foundation:foundation','androidx.compose.material3:material3',f'androidx.navigation:navigation-compose:{NAVIGATION}']
    else:deps+=['androidx.constraintlayout:constraintlayout:2.2.2','androidx.appcompat:appcompat:1.7.1','com.google.android.material:material:1.13.0']
    if backend=='xml' and any(n['type'] in {'ListView','GridView','RecyclerView','LazyColumn','LazyRow','LazyVerticalGrid','LazyStaggeredGrid'} for s in document['screens'] for n in walk(s['root'])):deps+=['androidx.recyclerview:recyclerview:1.4.0']
    dependencies=(f'implementation(platform("androidx.compose:compose-bom:{BOM}"))\n' if backend=='compose' else '')+'\n'.join(f'implementation("{d}")' for d in deps)
    files['settings.gradle.kts']='''pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }
rootProject.name = "AgataExport"
include(":app")
'''
    files['build.gradle.kts']='plugins {\n'+plugins+'}\n'
    files['gradle.properties']='android.useAndroidX=true\norg.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nkotlin.code.style=official\n'
    files['app/build.gradle.kts']=f'''plugins {{ {app_plugins} }}
android {{
 namespace = "{namespace}"
 compileSdk = 36
 defaultConfig {{ applicationId = "{namespace}"; minSdk = {min_sdk}; targetSdk = {target_sdk}; versionCode = 1; versionName = "1.0" }}
 compileOptions {{ sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }}
 kotlinOptions {{ jvmTarget = "17" }}
 {'buildFeatures { compose = true }' if backend=='compose' else ''}
}}
dependencies {{ {dependencies} }}
'''
    orientation_attr=f' android:screenOrientation="{orientation}"' if 'orientation' in settings else ''
    theme='@android:style/Theme.Material.Light.NoActionBar' if backend=='compose' else '@style/Theme.Agata'
    files['app/src/main/AndroidManifest.xml']=f'''<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:label="@string/app_name" android:theme="{theme}" android:supportsRtl="true"><activity android:name="{namespace}.MainActivity" android:exported="true"{orientation_attr}><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>\n'''
    files['app/src/main/res/values/colors.xml']=f'<resources><color name="agata_primary">{document["theme"]["primary"]}</color></resources>\n'
    warnings=[]
    for screen in document['screens']:
        for node in walk(screen['root']):
            if node.get('compose',{}).get('placeholder') or any(b.get('status')=='Dynamic' for b in node.get('compose',{}).get('styles',{}).values()):warnings.append({'node':node['id'],'message':'Compose dinâmico/parcial: a cópia gerada usa somente o subconjunto resolvido; consulte as fontes originais e os diagnósticos.'})
    for screen in document['screens']:
        for parent in walk(screen['root']):
            if parent['type']!='ConstraintLayout':continue
            for child in parent['children']:
                if child['type'] in {'Guideline','Barrier'}:continue
                c=child['layout']['constraints']
                for axis,anchors in [('horizontal',{'start','end'}),('vertical',{'top','bottom','baseline'})]:
                    if not set(c)&anchors:warnings.append({'node':child['id'],'message':'ConstraintLayout: eixo '+axis+' sem links; x/y convertido em margem explícita ao pai.'})
                if 'baseline' in c:warnings.append({'node':child['id'],'message':'Baseline: Preview estima métricas de fonte; confira a baseline nativa no Android.'})
    if backend=='xml':
        if any(n.get('motion') for s in document['screens'] for n in walk(s['root'])):warnings.append({'message':'XML: presets de motion usam fallback estático; a animação Compose permanece preservada no agata-model.json.'})
        for screen in document['screens']:
            for node in walk(screen['root']):
                if node['type']=='Row' and node['layout']['wrap']:warnings.append({'node':node['id'],'message':'XML: Row com quebra de linha usa LinearLayout sem wrap. Use Grid para uma grade nativa.'})
    files['agata-export-diagnostics.json']=json.dumps({'warnings':warnings,'android_build_verified':False},ensure_ascii=False,indent=2)+'\n'
    files['agata-model.json']=json.dumps(document,ensure_ascii=False,indent=2)+'\n'
    wrapper=Path(__file__).resolve().parents[1]/'resources/gradle'
    metadata=json.loads((wrapper/'metadata.json').read_text())
    jar=(wrapper/'gradle-wrapper.jar').read_bytes()
    if sha256(jar).hexdigest()!=metadata['wrapper_sha256']:raise ValueError('Gradle Wrapper local inválido.')
    files['gradle/wrapper/gradle-wrapper.jar']=jar
    files['gradlew']=(wrapper/'gradlew').read_text()
    files['gradlew.bat']=(wrapper/'gradlew.bat').read_text()
    files['GRADLE-LICENSE.txt']=(wrapper/'LICENSE.txt').read_text()
    files['GRADLE-NOTICE.txt']='Gradle Wrapper 8.13, Copyright Gradle Inc. Apache License 2.0. Unmodified upstream wrapper and scripts; see GRADLE-LICENSE.txt.\nSource: '+metadata['source']+'\n'
    files['gradle/wrapper/gradle-wrapper.properties']='distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-bin.zip\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\nnetworkTimeout=10000\nvalidateDistributionUrl=true\ndistributionSha256Sum='+metadata['distribution_sha256']+'\n'
    files['README.md']=f'''# Agata Android source ({backend})
Open in Android Studio with JDK 17 and Android SDK 36. Dependencies require network on first Gradle sync.
Pinned: AGP {AGP}, Gradle {GRADLE}, Kotlin/Compose compiler {KOTLIN}, Compose BOM {BOM}, Navigation {NAVIGATION}.
Gradle Wrapper is included with official wrapper/distribution SHA-256 and Apache-2.0 license.
Build: `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`). Set Android SDK location in Android Studio or local.properties.
No APK is included. Android build was not performed by the Agata exporter.
Workspace positions never become Android layout coordinates.
XML drawer/bottom/top bars use native LinearLayout panels; they are not full Material navigation widgets.
Custom source files override matching generated paths explicitly, independently per backend. They are not imported back into the visual model.
'''
    files.update({path[len(backend)+1:]:content for path,content in document['custom_files'].items() if path.startswith(backend+'/')})
    return files


def export_project(document,backend,root=None):
    files=generate(document,backend)
    root=Path(root) if root is not None else Path.home()/'Agata'/'Exports'
    root.mkdir(parents=True,exist_ok=True)
    name='android-'+backend+'-'+datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')+'-'+uuid4().hex[:8]+'.zip'
    target=root/name
    with ZipFile(target,'x',compression=ZIP_DEFLATED) as archive:
        for path,content in files.items():
            entry=ZipInfo('AgataExport/'+path)
            entry.compress_type=ZIP_DEFLATED
            entry.external_attr=(0o100755 if path=='gradlew' else 0o100644)<<16
            archive.writestr(entry,content)
    return {'ok':True,'path':str(target),'backend':backend,'file_count':len(files),'android_build_verified':False,'warnings':json.loads(files['agata-export-diagnostics.json'])['warnings']}
