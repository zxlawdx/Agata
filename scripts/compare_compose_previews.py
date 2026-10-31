"""Compare real Android and Agata PNGs only with explicit matching capture context.
Optional analysis dependency: Pillow. Never creates an Android baseline from web output.
"""
import argparse,json,sys
from pathlib import Path

KEYS=('viewport_dp','density','fontScale','theme','state','font_hashes')

def compare(android,web,android_context,web_context,tolerance=16,max_changed=.08):
    from PIL import Image,ImageChops,ImageFilter
    a=json.loads(Path(android_context).read_text());b=json.loads(Path(web_context).read_text())
    if any(k not in a or k not in b for k in KEYS):raise ValueError('Contexto incompleto: '+', '.join(KEYS))
    if any(a[k]!=b[k] for k in KEYS):raise ValueError('Capturas com viewport/densidade/fonte/tema/estado diferentes.')
    logical=tuple(a['viewport_dp']);images=[]
    for path,context in [(android,a),(web,b)]:
        image=Image.open(path).convert('RGB');expected=logical if context.get('pixel_space')=='css' else tuple(round(x*a['density']) for x in logical)
        if image.size!=expected:raise ValueError('Imagem não corresponde ao contexto; recorte somente o conteúdo do aplicativo: '+str(path))
        images.append(image.resize(logical,Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(.5)))
    diff=ImageChops.difference(*images);pixels=list(diff.getdata());changed=sum(max(p)>tolerance for p in pixels)/len(pixels)
    return {'passed':changed<=max_changed,'changed_fraction':changed,'mean_channel_error':sum(sum(p) for p in pixels)/(len(pixels)*3),'tolerance':tolerance,'max_changed_fraction':max_changed,'context':{k:a[k] for k in KEYS},'note':'Gaussian blur 0.5 logical px reduces antialiasing noise. Structural tests remain required.'}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('android');p.add_argument('web');p.add_argument('--android-context',required=True);p.add_argument('--web-context',required=True);p.add_argument('--tolerance',type=int,default=16);p.add_argument('--max-changed',type=float,default=.08);p.add_argument('--report',required=True);a=p.parse_args()
    try:result=compare(a.android,a.web,a.android_context,a.web_context,a.tolerance,a.max_changed)
    except (ValueError,ImportError) as exc:p.error(str(exc))
    Path(a.report).write_text(json.dumps(result,indent=2));print(json.dumps(result));sys.exit(0 if result['passed'] else 1)
