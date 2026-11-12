"""Approval-bound Chrome/ChatGPT task mailbox; never reads browser credentials.

The paired extension submits only the current question in a new ChatGPT tab.
Leases are single-use; interrupted/expired requests are never silently resent.
"""
import hashlib
import json
from pathlib import Path
import re
import secrets
import shutil
import sys
import time
from urllib.parse import urlsplit
from engine import core, online_provider

TTL=300
CLIENT=re.compile(r'[a-p]{32}\Z')
ASSETS=('manifest.json','background.js','chatgpt.js','popup.html','popup.js','popup.css')

def init_schema():
    with core.conn() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS browser_research(
          id TEXT PRIMARY KEY,task_id TEXT NOT NULL,question TEXT NOT NULL,role TEXT NOT NULL,
          status TEXT NOT NULL,answer TEXT NOT NULL DEFAULT '',sources TEXT NOT NULL DEFAULT '[]',
          error TEXT NOT NULL DEFAULT '',lease_hash TEXT NOT NULL DEFAULT '',
          client_id TEXT NOT NULL DEFAULT '',deadline REAL NOT NULL,created TEXT NOT NULL)''')

def status():
    paired=bool(CLIENT.fullmatch(core.setting('chrome_bridge_client','')))
    try:last=float(core.setting('chrome_bridge_seen','0'))
    except ValueError:last=0
    return {'provider':'chrome-chatgpt','model':'Your signed-in ChatGPT browser model',
            'configured':paired,'connected':paired and time.time()-last<90,
            'private_files_sent':False,'credentials_in_package':False,
            'note':'Uses the paired Chrome extension and your existing ChatGPT browser session. No API key or password is read.'}

def pair(client_id,*,confirmed=False):
    if confirmed is not True or not isinstance(client_id,str) or not CLIENT.fullmatch(client_id):
        raise core.EngineError('Confirm pairing the Chrome extension.')
    core.set_setting('chrome_bridge_client',client_id)
    core.set_setting('chrome_bridge_seen',str(time.time()))
    core.audit('chrome_bridge.paired',{'client_id':client_id})
    return status()

def _client(client_id):
    if not isinstance(client_id,str) or not CLIENT.fullmatch(client_id) or client_id!=core.setting('chrome_bridge_client',''):
        raise core.EngineError('This Chrome extension is not paired.')
    core.set_setting('chrome_bridge_seen',str(time.time()))

def prepare_extension(*,confirmed=False):
    if confirmed is not True:raise core.EngineError('Confirm preparing the Chrome extension files.')
    source=(Path(getattr(sys,'_MEIPASS'))/'chrome-bridge' if core.FROZEN
            else Path(__file__).resolve().parents[2]/'chrome_company_bridge')
    target=core.DATA.parent/'chrome-bridge'
    if target.is_symlink():raise core.EngineError('Refusing a linked extension directory.')
    target.mkdir(parents=True,exist_ok=True)
    manifest=target/'.installed-hashes.json'
    previous=json.loads(manifest.read_text()) if manifest.is_file() and not manifest.is_symlink() else {}
    for name in ASSETS:
        src=source/name;dest=target/name
        if not src.is_file() or dest.is_symlink():raise core.EngineError('Extension files are missing or linked.')
        if dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest() not in (previous.get(name),hashlib.sha256(src.read_bytes()).hexdigest()):
            raise core.EngineError('A modified extension file was preserved. Back it up before updating.')
    hashes={}
    for name in ASSETS:
        shutil.copyfile(source/name,target/name)
        hashes[name]=hashlib.sha256((target/name).read_bytes()).hexdigest()
    manifest.write_text(json.dumps(hashes,indent=2))
    return {'folder':str(target.resolve()),'installation_required':True,
            'instructions':'In Chrome extensions, choose Load unpacked and this folder. Then open TheOrg and click the extension’s Connect button.'}

def enqueue(task_id,question,role):
    init_schema()
    if (not isinstance(question,str) or not 3<=len(question.strip())<=12000
            or online_provider.has_probable_secret(question)):
        raise online_provider.ProviderUnavailable('Question is invalid or may contain credentials; redact it before browser research.')
    if not status()['configured']:
        raise online_provider.ProviderUnavailable('Pair the TheOrg Chrome bridge, then resume this task. Your existing ChatGPT session will be used.')
    ident=secrets.token_hex(12)
    with core.conn() as db:
        db.execute('INSERT INTO browser_research(id,task_id,question,role,status,deadline,created) VALUES(?,?,?,?,?,?,?)',
                   (ident,task_id,question,role,'queued',time.time()+TTL,core.utcnow()))
    return ident

def claim(client_id):
    init_schema();_client(client_id)
    with core.conn() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute("UPDATE browser_research SET status='expired',error='Browser research timed out; inspect the chat before retrying.' WHERE status IN ('queued','leased') AND deadline<?",(time.time(),))
        row=db.execute("""SELECT b.* FROM browser_research b JOIN tasks t ON t.id=b.task_id
            WHERE b.status='queued' AND t.status='running' ORDER BY b.created,b.rowid LIMIT 1""").fetchone()
        if not row:return {'request':None}
        lease=secrets.token_urlsafe(24)
        db.execute("UPDATE browser_research SET status='leased',client_id=?,lease_hash=? WHERE id=?",
                   (client_id,hashlib.sha256(lease.encode()).hexdigest(),row['id']))
    return {'request':{'id':row['id'],'question':row['question'],'role':row['role'],'lease':lease,'deadline':row['deadline']}}

def finish(client_id,ident,lease,answer='',sources=None,error=''):
    init_schema();_client(client_id)
    if not all(isinstance(x,str) for x in (ident,lease,answer,error)) or len(answer)>10000 or len(error)>500:
        raise core.EngineError('Invalid browser response.')
    if not isinstance(sources,list) or len(sources)>12:raise core.EngineError('Invalid research sources.')
    clean=[]
    for item in sources:
        if not isinstance(item,dict) or not isinstance(item.get('url'),str):raise core.EngineError('Invalid source URL.')
        parsed=urlsplit(item['url'])
        if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or len(item['url'])>1000:
            raise core.EngineError('Research sources must be credential-free HTTPS URLs.')
        clean.append({'url':item['url'],'title':str(item.get('title',''))[:200]})
    if not error and (len(answer.strip())<5 or not clean):raise core.EngineError('Browser answer needs text and a source.')
    with core.conn() as db:
        db.execute('BEGIN IMMEDIATE')
        row=db.execute('SELECT * FROM browser_research WHERE id=?',(ident,)).fetchone()
        if (not row or row['status']!='leased' or row['client_id']!=client_id or row['deadline']<time.time()
                or row['lease_hash']!=hashlib.sha256(lease.encode()).hexdigest()):
            raise core.EngineError('Browser lease is expired, completed or does not match.')
        task=db.execute('SELECT status FROM tasks WHERE id=?',(row['task_id'],)).fetchone()
        if not task or task['status']!='running':raise core.EngineError('Task is no longer accepting browser results.')
        db.execute('UPDATE browser_research SET status=?,answer=?,sources=?,error=?,lease_hash=? WHERE id=?',
                   ('failed' if error else 'completed',answer.strip(),json.dumps(clean),error,'',ident))
    return {'accepted':True,'independently_verified':False}

def complete(question,role,task_id,*,approved=False):
    if approved is not True:raise online_provider.ProviderUnavailable('Browser fallback needs approval.')
    ident=enqueue(task_id,question,role)
    for _ in range(TTL):
        with core.conn() as db:
            row=db.execute('SELECT * FROM browser_research WHERE id=?',(ident,)).fetchone()
            task=db.execute('SELECT status FROM tasks WHERE id=?',(task_id,)).fetchone()
            if not task or task['status']!='running':
                db.execute("UPDATE browser_research SET status='cancelled',lease_hash='' WHERE id=? AND status IN ('queued','leased')",(ident,))
                raise online_provider.ProviderUnavailable('Research was cancelled; any submitted chat remains in ChatGPT.')
        if row['status']=='completed':
            return {'answer':row['answer'],'sources':json.loads(row['sources']),
                    'provider':'chrome-chatgpt','independently_verified':False}
        if row['status'] in ('failed','expired','cancelled'):
            raise online_provider.ProviderUnavailable(row['error'] or 'Browser research did not complete.')
        time.sleep(1)
    with core.conn() as db:
        db.execute("UPDATE browser_research SET status='expired',lease_hash='',error='Browser response timed out; inspect ChatGPT before retrying.' WHERE id=? AND status IN ('queued','leased')",(ident,))
    raise online_provider.ProviderUnavailable('Browser research timed out; inspect ChatGPT before explicitly retrying.')
