from xml.etree import ElementTree as ET
import base64


def resolve_resources(files):
    result={'strings':{},'colors':{},'images':{},'paths':[]};warnings=[]
    for path,data in files.items():
        if '/res/' not in '/'+path:continue
        result['paths'].append(path)
        if '/values/' in path and path.endswith('.xml'):
            try:
                if b'<!DOCTYPE' in data or b'<!ENTITY' in data:raise ValueError('DTD não permitido')
                root=ET.fromstring(data)
                for child in root:
                    if child.tag in {'string','color'} and child.get('name'):
                        result['strings' if child.tag=='string' else 'colors'][child.get('name')]=''.join(child.itertext())
            except (ET.ParseError,ValueError):warnings.append({'path':path,'message':'XML de recursos inválido; original preservado.'})
        elif '/drawable' in path and path.lower().endswith('.png') and len(data)<2_000_000 and data.startswith(b'\x89PNG\r\n\x1a\n'):
            result['images'][path.rsplit('/',1)[-1][:-4]]='data:image/png;base64,'+base64.b64encode(data).decode()
    return result,warnings
