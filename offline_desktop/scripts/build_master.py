#!/usr/bin/env python3
"""Produce an immutable, deterministic TheOrg Master source-only ZIP and external receipt.

Source ZIP excludes caches, Git internals, credentials, SQLite and all GGUF models.
Build must not modify or delete existing user data or rewrite its own archive.
"""
from __future__ import annotations
import argparse,hashlib,json,re,subprocess,sys,zipfile
from datetime import datetime,timezone
from pathlib import Path

STAMP=(2026,1,1,0,0,0)
V='0.11.0-rc1'
PREFIX='TheOrg/'
RUNTIME=['app.py','Start-TheOrg-Windows.cmd','start-theorg.sh',
         'engine/__init__.py','engine/autopilot.py','engine/coding.py',
         'engine/core.py','engine/model_behavior.py','engine/gguf_diagnostics.py',
         'engine/device_capabilities.py',
         'scripts/master_compact_clean.py','scripts/get_qwen_tiny.py',
         'models/README.md','static/index.html','static/style.css','static/app.js',
         'static/icon.svg','static/sw.js','static/manifest.webmanifest',
         'THEORGS_MASTER.md']

def checksum(data):return hashlib.sha256(data).hexdigest()
def verify_manifest(package):
    with zipfile.ZipFile(package) as z:
        names=z.namelist()
        if len(names)!=len(set(names)):raise RuntimeError('Duplicate member')
        if any(not p.startswith(PREFIX) or '..' in Path(p).parts for p in names):raise RuntimeError('Unsafe member path')
        manifest=json.loads(z.read(PREFIX+'MASTER_MANIFEST.json'))
        expected={PREFIX+it['path']:it for it in manifest['files']}
        if set(names)!=(set(expected)|{PREFIX+'MASTER_MANIFEST.json'}):raise RuntimeError('File list mismatch')
        for path,entry in expected.items():
            body=z.read(path)
            if len(body)!=entry['bytes'] or checksum(body)!=entry['sha256']:raise RuntimeError('Manifest digest mismatch: '+path)
        return len(expected)

def check_source(root):
    tests=subprocess.run([sys.executable,'-m','unittest','discover','-s','tests','-q'],cwd=root,
                         stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
    match=re.search(r'Ran (\d+) tests?',tests.stdout)
    out={'python_tests':int(match.group(1)) if match else None,'python_result':'PASS' if tests.returncode==0 and match else 'FAIL',
         'python_exit_code':tests.returncode}
    if tests.returncode:raise RuntimeError('Python regression failure: '+tests.stdout[-2500:])
    try:
        node=subprocess.run(['node','--check','static/app.js'],cwd=root,
                            stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=15)
        out['javascript_syntax']='PASS' if node.returncode==0 else 'FAIL'
        if node.returncode:raise RuntimeError('JavaScript check failed: '+node.stdout[-900:])
    except FileNotFoundError:out['javascript_syntax']='NOT_TESTED (node unavailable)'
    smoke=subprocess.run([sys.executable,'app.py','--self-test'],cwd=root,
                         stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=35)
    out['app_self_test']='PASS' if smoke.returncode==0 and 'PASS' in smoke.stdout else 'FAIL'
    if out['app_self_test']!='PASS':raise RuntimeError('App smoke check failed: '+smoke.stdout[-900:])
    return out

def build(root,output,source_ref='local-review-only'):
    root=root.resolve(strict=True);output=output.resolve()
    if root in output.parents or output==root:raise ValueError('Output must live outside application source to avoid self-packaging')
    checks=check_source(root)
    base={path:(root/path).read_bytes() for path in RUNTIME}
    base['MASTER_README.md']=(f'TheOrg Master {V}\nSource-only lightweight runtime. '
        'Not an APK/EXE and does not contain model weights or llama-server.\n'
        'Read THEORGS_MASTER.md and use an approved local Python 3 interpreter to run app.py.\n'
        'Never delete .theorg/, data/, models/, workspaces or Git projects during upgrades.\n'
        'Restarted running tasks are interrupted until manually requeued.\n').encode()
    status={'version':V,'release_type':'source-only-runtime-rc','source_ref':source_ref,'verification':checks,
            'windows_exe':'NOT_TESTED','android_apk':'NOT_TESTED','real_gguf_generation':'NOT_TESTED',
            'real_autonomous_coding':'NOT_TESTED','physical_2gb_device':'NOT_TESTED',
            'model_weights_bundled':False,'llama_cpp_bundled':False}
    base['BUILD-STATUS.json']=(json.dumps(status,sort_keys=True,indent=2)+'\n').encode()
    entries=[{'path':name,'bytes':len(blob),'sha256':checksum(blob)} for name,blob in sorted(base.items())]
    manifest={'manifest_version':2,'version':V,'source_ref':source_ref,
              'hash':'SHA-256','files':entries,
              'note':'This checks archive member integrity, not a signature or model performance.'}
    base['MASTER_MANIFEST.json']=(json.dumps(manifest,indent=2,sort_keys=True)+'\n').encode()
    output.parent.mkdir(parents=True,exist_ok=True)
    if output.exists():raise FileExistsError('Release artifact already exists: '+str(output))
    with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name,data in sorted(base.items()):
            zi=zipfile.ZipInfo(PREFIX+name,STAMP)
            zi.compress_type=zipfile.ZIP_DEFLATED
            zi.external_attr=0o644<<16
            z.writestr(zi,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    number=verify_manifest(output)
    receipt={'name':output.name,'size_bytes':output.stat().st_size,'sha256':checksum(output.read_bytes()),
             'manifest_entries':number,'source_ref':source_ref,'checks':checks,
             'platform':'Linux/source verification only','signed':False,
             'real_gguf':'NOT_TESTED','windows':'NOT_TESTED','android':'NOT_TESTED'}
    rec=output.with_suffix(output.suffix+'.receipt.json')
    rec.write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n')
    output.with_suffix(output.suffix+'.sha256').write_text(receipt['sha256']+'  '+output.name+'\n')
    return receipt

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--source-ref',default='local-reviewed-source-baseline')
    a=ap.parse_args();print(json.dumps(build(a.root,a.output,a.source_ref),indent=2))
