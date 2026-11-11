#!/usr/bin/env python3
"""Fail-closed Windows release receipt and executable integrity gate.

A passing source test suite or MZ stub is not a distributable EXE. This gate
requires an AMD64 PE32+ header, exact executable hash and a Windows smoke
receipt from the same binary. Real-model inference remains a separate gate.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

REQUIRED = (
    'exe_self_test', 'dashboard_http', 'api_token_auth', 'bundled_git',
    'bundled_llama_runtime', 'local_git_project', 'desktop_shortcut',
)

def sha256_file(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def is_amd64_pe(path):
    """Validate basic PE64 structure without running untrusted bytes."""
    if not path.is_file() or path.stat().st_size < 1_000_000:
        return False
    with path.open('rb') as f:
        header=f.read(512)
        if len(header)<64 or header[:2]!=b'MZ':
            return False
        pe_offset=int.from_bytes(header[0x3c:0x40], 'little')
        if not 0x40<=pe_offset<=1_048_576:
            return False
        f.seek(pe_offset)
        signature=f.read(26)
    return (len(signature)==26 and signature[:4]==b'PE\x00\x00'
            and int.from_bytes(signature[4:6],'little')==0x8664
            and int.from_bytes(signature[24:26],'little')==0x20b)

def validate_release(directory):
    directory=Path(directory)
    result={'status':'failed','release':'TheOrg v0.10 portable Windows','checks':{}}
    exe=directory/'TheOrg.exe'
    digest_file=directory/'SHA256SUMS.txt'
    receipt_file=directory/'WINDOWS-SMOKE.json'
    upstream_file=directory/'UPSTREAM-DIGESTS.txt'
    problems=[]
    if not is_amd64_pe(exe):
        problems.append('Executable missing or invalid AMD64 Windows PE structure')
    else:
        result['checks']['pe_header']=True
    digest=sha256_file(exe) if exe.is_file() else None
    result['exe_sha256']=digest
    if not digest_file.is_file():
        problems.append('SHA256SUMS.txt missing')
    else:
        line=digest_file.read_text(encoding='utf-8-sig').strip()
        if not re.fullmatch(r'[0-9a-fA-F]{64}  TheOrg\.exe',line):
            problems.append('Checksum manifest malformed')
        elif line[:64].lower()!=digest:
            problems.append('Checksum mismatch')
        else:
            result['checks']['checksum']=True
    if not upstream_file.is_file():
        problems.append('UPSTREAM-DIGESTS.txt missing')
    else:
        upstream=upstream_file.read_text(encoding='utf-8-sig')
        if (not re.search(r'llama\.cpp\s+b\d+\s+[0-9a-f]{64}',upstream)
                or not re.search(r'MinGit\s+v[\w.]+\s+[0-9a-f]{64}',upstream)):
            problems.append('Upstream dependency digest receipt malformed')
        else:
            result['checks']['upstream_digest_receipt']=True
    if not receipt_file.is_file():
        problems.append('Windows runtime acceptance receipt missing')
    else:
        try:
            receipt=json.loads(receipt_file.read_text(encoding='utf-8-sig'))
            checks=receipt['checks']
            if receipt.get('exe_sha256')!=digest:
                problems.append('Smoke receipt does not match executable hash')
            if receipt.get('version')!='0.10.0':
                problems.append('Smoke receipt version mismatch')
            for name in REQUIRED:
                if checks.get(name) is not True:
                    problems.append('Missing successful Windows runtime gate: '+name)
            if all(checks.get(name) is True for name in REQUIRED):
                result['checks']['runtime_receipt']=True
        except (OSError,ValueError,KeyError,TypeError):
            problems.append('Windows runtime receipt malformed')
    result['problems']=problems
    result['status']='passed' if not problems else 'failed'
    result['real_gguf_inference']='not-tested'
    result['autonomous_coding']='not-tested'
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dist',type=Path)
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    result=validate_release(args.dist)
    report=json.dumps(result,sort_keys=True,indent=2)+'\n'
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(report,encoding='utf-8')
    print(report)
    return 0 if result['status']=='passed' else 1

if __name__=='__main__':
    raise SystemExit(main())
