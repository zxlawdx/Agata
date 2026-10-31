"""Loopback-only browser fixture: real Vela templates/static HTTP and Python services.

The pywebview transport is replaced by HTTP for this fixture, never in the app.
All project/export files are isolated in a temporary directory.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import tempfile
from types import SimpleNamespace
from bottle import request, response
from vela.cli.collectstatic import collect_static
from vela.core.api_server import ApiServer
from vela.core.router import Router
from apps.home.views import register_routes as home_routes
from apps.sketch_editor.views import register_routes as editor_routes
import config.bridge as bridge_module
from apps.workspace.repositories.json_repository import JsonProjectRepository

collect_static(skip_tailwind=True, asset_config={'tailwind': False}, allow_install=False, verbose=False)
router = Router()
home_routes(router)
editor_routes(router)
from apps.android_designer.views import register_routes as android_routes
android_routes(router)
server = ApiServer(SimpleNamespace(routes=[]), port=0, docs_enabled=False)
fixture_root = tempfile.TemporaryDirectory(prefix='agata-ui-')
repository = JsonProjectRepository(Path(fixture_root.name)/'Agata'/'Projetos', Path(fixture_root.name)/'Yara'/'Projetos')
bridge_module.project_repository = lambda: repository
bridge = bridge_module.AgataBridge.__new__(bridge_module.AgataBridge)
from apps.sketch_editor.services.exports import ArtworkExporter
from xml.etree import ElementTree
import struct

def export_artwork(project_id, file_format, data=''):
    result=ArtworkExporter(repository, Path(fixture_root.name)/'Exports').export(project_id,file_format,data)
    payload=Path(result['path']).read_bytes()
    if file_format=='svg':
        ElementTree.fromstring(payload)
    elif file_format=='png':
        assert struct.unpack('>II',payload[16:24]) == (512,512)
    return result
bridge.export_artwork=export_artwork
def export_android(project_id,backend):
    from apps.android_designer.services.documents import InterfaceService
    from apps.android_designer.exporters.project import export_project
    return export_project(InterfaceService(repository).get(project_id)['document'],backend,Path(fixture_root.name)/'Exports')
bridge.export_android=export_android
allowed = {'list_projects', 'create_project', 'get_project', 'save_sketch', 'export_artwork', 'get_interface', 'save_interface', 'generate_android', 'validate_interface', 'export_android'}

@server.app.post('/fixture/api/<method>')
def call(method):
    if method not in allowed:
        response.status=404
        return {'error': 'Unknown method'}
    try:
        return {'result': getattr(bridge, method)(*(request.json or []))}
    except Exception as exc:
        response.status=400
        return {'error': str(exc)}

@server.app.post('/fixture/render')
def render():
    data=request.json
    return {'html': router.resolve(data['path'],data.get('params') or {}).html}

@server.app.get('/fixture')
def fixture():
    return '''<!doctype html><html><head><style>
html,body{margin:0;width:100%;height:100%}.vela-shell__app-root{height:100%;overflow:var(--vela-app-overflow,auto)}
</style></head><body><main class="vela-shell__app-root"><div id="vela-page"></div></main><script>
window.pywebview={api:new Proxy({}, {get:(_,name)=>async(...args)=>{
 const r=await fetch('/fixture/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});
 const data=await r.json();if(!r.ok)throw Error(data.error);return data.result;
}})};
window.Vela={navigate:async(path,params={})=>{
 if(window.VelaPage?.beforeUnmount)await window.VelaPage.beforeUnmount();window.VelaPage={};
 const r=await fetch('/fixture/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,params})});
 const data=await r.json();const host=document.getElementById('vela-page');host.innerHTML=data.html;
 for(const old of host.querySelectorAll('script')){
  const node=document.createElement('script');if(old.src){node.src=old.src;await new Promise((ok,fail)=>{node.onload=ok;node.onerror=fail;old.replaceWith(node)});}
  else{node.textContent=old.textContent;old.replaceWith(node);}
 }
 window.Vela.currentPath=path;
}};window.Vela.navigate('/home');</script></body></html>'''

if __name__=='__main__':
    server.start()
    router.base_url = f"http://127.0.0.1:{server.port}"
    print(f'http://127.0.0.1:{server.port}/fixture', flush=True)
    import threading
    threading.Event().wait()
