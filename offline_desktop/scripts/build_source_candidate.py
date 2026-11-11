#!/usr/bin/env python3
"""Reproducible TheOrg SOURCE archive, no weights, tokens, database or release claim."""
from __future__ import annotations
import argparse,hashlib,json,re,subprocess,sys,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TOP={'app.py','README.md','Start-TheOrg-Windows.cmd','Build-TheOrg-Portable-Windows.ps1',
     'Run-Tests-Windows.cmd','start-theorg.sh','THEORGS_MASTER.md'}
DIRECTORIES=('engine','static','scripts','tests','models','docs','.github','bin','packaging')
SUFFIXES={'.py','.js','.css','.html','.svg','.json','.md','.txt','.sh','.cmd','.ps1','.nsi','.yml','.yaml','.webmanifest'}
EXCLUDED={'__pycache__','.git','.theorg','data','workspace','dist','build','node_modules','.build-cache'}

def files(root=ROOT):
    root=Path(root).resolve()
    paths=[root/name for name in TOP]
    for directory in DIRECTORIES:
        folder=root/directory
        if folder.is_dir():paths.extend(folder.rglob('*'))
    result=[]
    for p in paths:
        if not p.is_file() or p.is_symlink():continue
        if set(p.relative_to(root).parts)&EXCLUDED or p.suffix.lower() not in SUFFIXES:continue
        if p.stat().st_size>350000:raise ValueError('Unexpected large asset: '+str(p))
        if not p.resolve().is_relative_to(root):raise ValueError('Path escapes source')
        result.append(p)
    return sorted(set(result),key=lambda p:p.relative_to(root).as_posix())

def validate_source(root=ROOT):
    p=subprocess.run([sys.executable,'-m','unittest','discover','-s','tests','-q'],
                     cwd=root,capture_output=True,text=True,timeout=150)
    text=p.stdout+'\n'+p.stderr
    match=re.search(r'Ran\s+(\d+)\s+tests?\s+in\s+[\d.]+s\s+OK',text)
    if p.returncode!=0 or not match:
        raise RuntimeError('Source tests failed: '+text[-2000:])
    return int(match.group(1))

def build(output,root=ROOT,run_tests=True):
    root=Path(root).resolve();output=Path(output).resolve()
    if output.is_relative_to(root):raise ValueError('Output must be outside the source tree')
    count=validate_source(root) if run_tests else None
    paths=files(root)
    manifest={'schema':'theorg-source-candidate-v1','kind':'source_only',
              'python_tests':count,'windows_exe':'not_tested',
              'real_gguf':'not_tested','autonomous_coding':'not_tested',
              'files':{p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'w',allowZip64=True) as z:
        for file in paths:
            info=zipfile.ZipInfo('TheOrg/'+file.relative_to(root).as_posix(),(2026,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,file.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
        info=zipfile.ZipInfo('TheOrg/RELEASE-MANIFEST.json',(2026,1,1,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,json.dumps(manifest,indent=2,sort_keys=True)+'\n',compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    manifest['zip_sha256']=hashlib.sha256(output.read_bytes()).hexdigest()
    manifest['zip_bytes']=output.stat().st_size
    return manifest

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    parser.add_argument('--no-tests',action='store_true')
    args=parser.parse_args()
    result=build(args.output,run_tests=not args.no_tests)
    args.output.with_suffix('.verification.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'zip':str(args.output),'sha256':result['zip_sha256'],
                      'test_count':result['python_tests'],'kind':'source_only'},indent=2))
if __name__=='__main__':raise SystemExit(main())
