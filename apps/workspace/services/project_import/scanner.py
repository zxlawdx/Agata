"""Bounded local snapshot reader. No extractall, shell, network or dependency loading."""
from pathlib import Path,PurePosixPath
from zipfile import ZipFile,BadZipFile
import stat,base64
MAX_FILES=2000;MAX_TOTAL=100*1024*1024;MAX_FILE=8*1024*1024;MAX_ARCHIVE=30*1024*1024
IGNORED={'.git','.gradle','build','node_modules','.idea','__MACOSX'}


def safe_name(value):
    if not isinstance(value,str) or not value or '\\' in value or '\x00' in value or ':' in value:raise ValueError('Caminho de arquivo inválido.')
    p=PurePosixPath(value)
    if p.is_absolute() or any(x in {'..','.'} for x in value.split('/')):raise ValueError('Path traversal bloqueado.')
    return p.as_posix()


def snapshot(path):
    path=Path(path).expanduser()
    if path.is_symlink():raise ValueError('Links simbólicos não são importados.')
    files={};total=0;seen=set()
    def add(name,data):
        nonlocal total
        name=safe_name(name)
        if set(PurePosixPath(name).parts)&IGNORED:return
        if name.casefold() in seen:raise ValueError('Arquivos duplicados ou nomes conflitantes.')
        seen.add(name.casefold());total+=len(data)
        if len(data)>MAX_FILE or total>MAX_TOTAL or len(files)>=MAX_FILES:raise ValueError('Projeto excede os limites de importação.')
        files[name]=data
    if path.is_dir():
        for p in sorted(path.rglob('*')):
            rel=p.relative_to(path)
            if set(rel.parts)&IGNORED:continue
            if p.is_symlink():raise ValueError('Link simbólico bloqueado: '+str(rel))
            if p.is_file():
                if p.stat().st_size>MAX_FILE:raise ValueError('Arquivo muito grande: '+str(rel))
                add(rel.as_posix(),p.read_bytes())
    elif path.is_file() and path.suffix.lower()=='.zip':
        if path.stat().st_size>MAX_ARCHIVE:raise ValueError('ZIP excede 30 MB.')
        try:
            with ZipFile(path) as archive:
                if len(archive.infolist())>MAX_FILES:raise ValueError('ZIP tem arquivos demais.')
                declared=0
                for info in archive.infolist():
                    name=safe_name(info.filename.rstrip('/'))
                    mode=info.external_attr>>16
                    if stat.S_ISLNK(mode) or mode and stat.S_IFMT(mode) not in {0,stat.S_IFREG,stat.S_IFDIR}:raise ValueError('Link/arquivo especial no ZIP.')
                    if info.flag_bits&1:raise ValueError('ZIP criptografado não suportado.')
                    declared+=info.file_size
                    if info.file_size>MAX_FILE or declared>MAX_TOTAL or info.file_size>max(1,info.compress_size)*1000:raise ValueError('ZIP excede os limites de descompressão.')
                    if not info.is_dir():add(name,archive.read(info))
        except (BadZipFile,RuntimeError,EOFError) as exc:raise ValueError('ZIP inválido ou corrompido.') from exc
    elif path.is_file() and path.suffix.lower() in {'.kt','.json'}:add(path.name,path.read_bytes())
    else:raise ValueError('Selecione uma pasta, ZIP, arquivo Kotlin ou projeto Agata JSON.')
    # Only unwrap a single enclosing folder, never discard siblings.
    while files and all('/' in k for k in files) and len({k.split('/')[0] for k in files})==1:files={k.split('/',1)[1]:v for k,v in files.items()}
    return files


def text_files(files):
    result={}
    for path,data in files.items():
        if Path(path).suffix.lower() in {'.kt','.kts','.gradle','.xml','.json','.properties','.md','.txt','.toml'}:
            try:result[path]=data.decode('utf-8-sig')
            except UnicodeDecodeError:pass
    return result
