from xml.etree import ElementTree as ET
import base64


def resolve_resources(files):
    result={'strings':{},'colors':{},'images':{},'paths':[],'fonts':{},'variants':{'colors':{},'strings':{}}};warnings=[]
    for path,data in files.items():
        if '/res/' not in '/'+path:continue
        result['paths'].append(path)
        if any(part.startswith('values') for part in path.split('/')) and path.endswith('.xml'):
            try:
                if b'<!DOCTYPE' in data or b'<!ENTITY' in data:raise ValueError('DTD não permitido')
                root=ET.fromstring(data)
                for child in root:
                    if child.tag in {'string','color'} and child.get('name'):
                        kind='strings' if child.tag=='string' else 'colors';value=''.join(child.itertext());qualifier=next(p for p in path.split('/') if p.startswith('values'))
                        result['variants'][kind].setdefault(child.get('name'),{})[qualifier]={'value':value,'path':path}
                        if qualifier=='values':result[kind][child.get('name')]=value
            except (ET.ParseError,ValueError):warnings.append({'path':path,'message':'XML de recursos inválido; original preservado.'})
        elif '/font/' in path and len(data)<2_000_000 and (data.startswith(b'OTTO') or data.startswith(b'\x00\x01\x00\x00')):
            result['fonts'][path.rsplit('/',1)[-1].rsplit('.',1)[0]]='data:font/'+('otf' if data.startswith(b'OTTO') else 'ttf')+';base64,'+base64.b64encode(data).decode()
        elif '/drawable' in path and path.lower().endswith('.png') and len(data)<2_000_000 and data.startswith(b'\x89PNG\r\n\x1a\n'):
            result['images'][path.rsplit('/',1)[-1][:-4]]='data:image/png;base64,'+base64.b64encode(data).decode()
    return result,warnings
