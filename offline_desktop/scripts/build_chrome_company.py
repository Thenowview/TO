"""Build one portable Chrome-first Windows EXE from verified local inputs.

No downloads, credentials, browser profiles, task databases or user files are bundled.
The GGUF is unpacked by the onefile bootloader at launch; user data stays beside EXE.
"""
import argparse
import hashlib
from pathlib import Path
import subprocess
import sys
import zipfile

PINS={
 'llama-b12248-bin-win-cpu-x64.zip':'bb306bfd390f8782c0acaba490505d12f07392791b48f1dd039387a5bacf1181',
 'MinGit-2.52.0-64-bit.zip':'f42a561840627747ad48e6ece05a14093292d31f3393a401a7f7c780ee7695c2',
 'Qwen3.5-0.8B-Q4_0.gguf':'57d1997790d1744fba5b40a7317df71ea5e2acee28c47e78f0cce39c0703f8cf'}
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(4*1024**2),b''):h.update(block)
    return h.hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache',type=Path,required=True);p.add_argument('--model',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True);p.add_argument('--build-dir',type=Path,required=True)
    a=p.parse_args();root=Path(__file__).resolve().parents[1]
    for file in [a.cache/name for name in PINS if name.endswith('.zip')]+[a.model]:
        if file.name not in PINS or digest(file)!=PINS[file.name]:raise ValueError('Unverified build input: '+file.name)
    a.build_dir.mkdir(parents=True,exist_ok=True)
    runtime=a.build_dir/'runtime';git=a.build_dir/'git'
    for file,target in [(a.cache/'llama-b12248-bin-win-cpu-x64.zip',runtime),(a.cache/'MinGit-2.52.0-64-bit.zip',git)]:
        with zipfile.ZipFile(file) as z:
            if any('..' in Path(n).parts or Path(n).is_absolute() for n in z.namelist()):raise ValueError('Unsafe upstream archive')
            z.extractall(target)
    binary=next(runtime.rglob('llama-server.exe'))
    args=[sys.executable,'-m','PyInstaller','--noconfirm','--clean','--onefile','--windowed',
          '--name','TheOrg-Company','--distpath',str(a.output.resolve()),'--workpath',str((a.build_dir/'pyinstaller').resolve()),
          '--specpath',str(a.build_dir.resolve()),'--add-data',str(root/'static')+';static',
          '--add-data',str(root.parent/'config/adaptive-model-registry.json')+';config',
          '--add-data',str(root/'RELEASE-COMPANY.md')+';release',
          '--add-data',str(root/'licenses')+';licenses',
          '--add-data',str(root.parent/'chrome_company_bridge')+';chrome-bridge',
          '--add-data',str(a.model.resolve())+';bundled-models',
          '--add-data',str(git.resolve())+';bin/git','--add-binary',str(binary.resolve())+';bin']
    for dll in binary.parent.glob('*.dll'):args+=['--add-binary',str(dll.resolve())+';bin']
    subprocess.run(args+[str(root/'app.py')],cwd=root,check=True)
    exe=a.output/'TheOrg-Company.exe'
    print('Built',exe,'SHA256',digest(exe),flush=True)
if __name__=='__main__':main()
