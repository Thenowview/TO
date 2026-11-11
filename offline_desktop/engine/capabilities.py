"""Single-use, time-bound approvals for optional local browser and desktop tools."""
from __future__ import annotations
import hashlib,json,os,re,secrets,time
from engine import core

TTL=300
CATALOG={
 'browser.local.inspect': {'kind':'browser','description':'Inspect approved workspace HTML offline in disposable Chromium.'},
 'desktop.workspace.open': {'kind':'desktop','description':'Open only the dedicated TheOrg workspace in Windows Explorer.'},
}
def init_schema():
    with core.conn() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS capability_requests (
           id TEXT PRIMARY KEY, capability TEXT NOT NULL, args_json TEXT NOT NULL,
           digest TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL,
           updated INTEGER NOT NULL, result_json TEXT NOT NULL DEFAULT '{}')''')

def enabled(name):
    if name=='browser.local.inspect':return os.environ.get('THEORG_ENABLE_BROWSER_PREVIEW')=='1'
    if name=='desktop.workspace.open':return os.environ.get('THEORG_ENABLE_OS_ACTIONS')=='1'
    return False

def catalog():
    return [{'id':name,**details,'enabled':enabled(name)} for name,details in CATALOG.items()]

def normalize(name,args):
    if name not in CATALOG:raise core.EngineError('Capability is not allowlisted.')
    if not enabled(name):raise core.EngineError('Capability disabled by operator configuration.')
    if type(args) is not dict:raise core.EngineError('Arguments must be JSON object.')
    if name=='desktop.workspace.open':
        if args:raise core.EngineError('Workspace opening takes no arguments.')
        return {}
    if set(args)!={'file','actions'} or type(args['file']) is not str:
        raise core.EngineError('Browser preview requires file and actions.')
    from engine import browser_local
    browser_local.validate(args['file'],args['actions'])
    return {'file':args['file'],'actions':args['actions']}

def prepare(name,args):
    args=normalize(name,args)
    ident=secrets.token_hex(12)
    raw=json.dumps({'capability':name,'arguments':args},sort_keys=True,separators=(',',':'))
    digest=hashlib.sha256(raw.encode()).hexdigest()
    now=int(time.time())
    with core.conn() as db:
        db.execute('INSERT INTO capability_requests(id,capability,args_json,digest,status,created,updated) VALUES(?,?,?,?,?,?,?)',
                   (ident,name,json.dumps(args,sort_keys=True),digest,'pending',now,now))
    core.audit('capability.prepared',{'id':ident,'capability':name})
    return {'id':ident,'capability':name,'arguments':args,'digest':digest,
            'expires_at':now+TTL,'status':'pending'}

def history(limit=30):
    if type(limit) is not int or not 1<=limit<=100:raise core.EngineError('Invalid history limit.')
    return core.records('SELECT id,capability,digest,status,created,updated,result_json FROM capability_requests ORDER BY created DESC,id DESC LIMIT ?',(limit,))

def _execute(name,args):
    if name=='browser.local.inspect':
        from engine import browser_local
        return browser_local.inspect(args['file'],args['actions'])
    if name=='desktop.workspace.open':
        if os.name!='nt' or not hasattr(os,'startfile'):
            raise core.EngineError('Explorer action requires Windows.')
        core.WORKSPACE.mkdir(parents=True,exist_ok=True)
        os.startfile(str(core.WORKSPACE))
        return {'opened':True,'scope':'TheOrg workspace only'}
    raise core.EngineError('Unknown capability execution')

def approve_and_execute(ident,digest,confirmed=False):
    if confirmed is not True:raise core.EngineError('Separate explicit execution approval required.')
    if type(ident) is not str or not re.fullmatch(r'[0-9a-f]{24}',ident):
        raise core.EngineError('Invalid request ID.')
    if type(digest) is not str or not re.fullmatch(r'[0-9a-f]{64}',digest):
        raise core.EngineError('Invalid approval digest.')
    now=int(time.time())
    with core.conn() as db:
        db.execute('BEGIN IMMEDIATE')
        row=db.execute('SELECT * FROM capability_requests WHERE id=?',(ident,)).fetchone()
        if row is None or row['status']!='pending' or row['digest']!=digest:
            raise core.EngineError('Request missing, consumed, or digest mismatch.')
        if now-row['created']>TTL:
            db.execute("UPDATE capability_requests SET status='expired',updated=? WHERE id=?",(now,ident))
            raise core.EngineError('Capability approval expired.')
        if not enabled(row['capability']):raise core.EngineError('Capability now disabled.')
        db.execute("UPDATE capability_requests SET status='running',updated=? WHERE id=?",(now,ident))
    name=row['capability'];args=json.loads(row['args_json'])
    try:
        output=_execute(name,args);result={'ok':True,'result':output};status='completed'
    except Exception as e:
        result={'ok':False,'error':str(e)[:350]};status='failed'
    with core.conn() as db:
        db.execute('UPDATE capability_requests SET status=?,updated=?,result_json=? WHERE id=?',
                   (status,int(time.time()),json.dumps(result)[:5000],ident))
    core.audit('capability.'+status,{'id':ident,'capability':name})
    return {'id':ident,'status':status,**result}
