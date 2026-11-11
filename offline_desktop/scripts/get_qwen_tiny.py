#!/usr/bin/env python3
"""Explicit opt-in fetch of a verified upstream tiny model; never run by installer."""
from __future__ import annotations
import argparse,hashlib,os,sys,urllib.request
from pathlib import Path
MODEL_NAME='Qwen3.5-0.8B-Q4_0.gguf'
URL='https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF/resolve/main/'+MODEL_NAME
SHA256='57d1997790d1744fba5b40a7317df71ea5e2acee28c47e78f0cce39c0703f8cf'
MAX_BYTES=700_000_000

def main():
    parser=argparse.ArgumentParser(description='Optional download; requires Internet once; model works offline afterward.')
    parser.add_argument('--accept-download',action='store_true',help='Approve the ~563 MB Internet download')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]/'models';root.mkdir(exist_ok=True)
    target=root/MODEL_NAME
    print('Source:',URL)
    print('Expected SHA256:',SHA256)
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest()==SHA256:
        print('Verified existing model:',target);return
    if not args.accept_download:
        print('No download performed. Re-run with --accept-download to fetch this exact GGUF.');return
    temp=target.with_suffix('.gguf.partial');downloaded=0;digest=hashlib.sha256()
    try:
        with urllib.request.urlopen(URL,timeout=60) as src,open(temp,'wb') as dst:
            if not src.geturl().startswith(('https://huggingface.co/','https://cdn-lfs.huggingface.co/','https://cas-bridge.xethub.hf.co/','https://cas-server.xethub.hf.co/')):
                raise RuntimeError('Unexpected download host')
            while True:
                chunk=src.read(128*1024)
                if not chunk:break
                downloaded+=len(chunk)
                if downloaded>MAX_BYTES:raise RuntimeError('Download exceeds 700 MB safety limit')
                digest.update(chunk);dst.write(chunk)
        if digest.hexdigest()!=SHA256:raise RuntimeError('SHA256 mismatch; file rejected')
        if downloaded<10_000_000:raise RuntimeError('Incomplete or invalid download')
        os.replace(temp,target)
        print('PASS downloaded and verified:',target,'(',downloaded,'bytes )')
    finally:
        if temp.exists():temp.unlink()
if __name__=='__main__':main()
