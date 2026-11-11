#!/usr/bin/env python3
"""Safe offline-only diagnostics, not a claim of model performance."""
import json, sys, shutil
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from engine import core, coding

def main():
    print('TheOrg Offline Engine — local diagnostics')
    print('Python:',sys.version.split()[0]);core.init()
    coding.init_schema()
    print('SQLite persistence:',core.DB,'OK')
    print('Code Studio Git CLI:',shutil.which('git') or 'MISSING — Code Studio unavailable')
    print('Local coding projects:',len(core.records('SELECT id FROM code_projects')))
    print('Workspace:',core.WORKSPACE,'OK')
    print('GGUF model files:',len(core.local_models()))
    print('llama-server binary:',core.llama_binary() or 'NOT INSTALLED')
    b=core.available_backends()
    print('llama.cpp HTTP ready:',b['llamacpp'])
    print('Ollama installed models:',b['ollama'])
    print('Local inference:', 'READY' if core.active_backend()[0] else 'NOT AVAILABLE — model/runtime required')
    print('Role profiles:',len(core.PROFILES))
    print('NO network services beyond loopback inference were contacted.')
if __name__=='__main__':main()
