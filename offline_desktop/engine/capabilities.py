"""Single-use, time-bound approvals for optional local browser and desktop tools."""
from __future__ import annotations
import hashlib,json,os,re,secrets,time
from pathlib import Path
from engine import core

TTL=300
CATALOG={
 'browser.local.inspect': {'kind':'browser','description':'Inspect approved workspace HTML offline in disposable Chromium.'},
 'desktop.workspace.open': {'kind':'desktop','description':'Open only the dedicated TheOrg workspace in Windows Explorer.'},
 'desktop.runner.inspect': {'kind':'desktop','description':'Read-only check of approved GitHub runner installation files; does not inspect tokens or prove online status.'},
 'windows.powershell.inspect': {'kind':'desktop','description':'Execute a fixed, read-only PowerShell inspection; arbitrary commands prohibited.'},
 'windows.source.verify': {'kind':'desktop','description':'Run fixed source tests in an explicitly trusted local checkout at an approved commit SHA.'},
 'github.runner.status': {'kind':'github','description':'Read runner Online/Idle and labels from authenticated GitHub API.'},
 'github.workflow.status': {'kind':'github','description':'Read recent CI runs from authenticated GitHub API.'},
 'github.workflow.source_dispatch': {'kind':'github','description':'Trigger source-only CI on a reviewed commit; no builds, merge or deployment.'},
}
def init_schema():
    with core.conn() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS capability_requests (
           id TEXT PRIMARY KEY, capability TEXT NOT NULL, args_json TEXT NOT NULL,
           digest TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL,
           updated INTEGER NOT NULL, result_json TEXT NOT NULL DEFAULT '{}')''')
        # The engine may have crashed after a side-effecting tool ran.
        # Never retry such work automatically or imply it never happened.
        db.execute("""UPDATE capability_requests SET status='needs_review',
            result_json=?,updated=? WHERE status='running'""",
            (json.dumps({'ok':False,'execution_outcome':'unverified',
             'error':'Interrupted during execution; inspect evidence before a new request.'}),
             int(time.time())))

def enabled(name):
    if name=='browser.local.inspect':return os.environ.get('THEORG_ENABLE_BROWSER_PREVIEW')=='1'
    if name=='desktop.workspace.open':return os.environ.get('THEORG_ENABLE_OS_ACTIONS')=='1'
    if name=='desktop.runner.inspect':return os.environ.get('THEORG_ENABLE_RUNNER_DIAGNOSTICS')=='1'
    if name=='windows.powershell.inspect':return os.environ.get('THEORG_ENABLE_WINDOWS_INSPECTION')=='1'
    if name=='windows.source.verify':return os.environ.get('THEORG_ENABLE_LOCAL_SOURCE_TESTS')=='1'
    if name in ('github.runner.status','github.workflow.status'):
        return os.environ.get('THEORG_ENABLE_GITHUB_READONLY')=='1'
    if name=='github.workflow.source_dispatch':
        return os.environ.get('THEORG_ENABLE_GITHUB_ACTIONS')=='1'
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
    if name=='desktop.runner.inspect':
        if set(args)!={'location'} or args['location'] not in ('user_downloads','system_root'):
            raise core.EngineError('Choose a fixed runner location: user_downloads or system_root.')
        return {'location':args['location']}
    if name.startswith('github.') or name in ('windows.powershell.inspect','windows.source.verify'):
        from engine import operator_tools
        return operator_tools.normalize(name,args)
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

def _runner_probe(root: Path) -> dict:
    """Inspect only known runner file existence; never read credential/token contents."""
    if root.is_symlink():
        raise core.EngineError('Runner installation directory may not be a symlink.')
    required=('config.cmd','run.cmd','bin','externals')
    exists={}
    for name in required:
        entry=root/name
        exists[name]=not entry.is_symlink() and (
            entry.is_dir() if name in ('bin','externals') else entry.is_file())
    registration=root/'.runner'
    registered=registration.is_file() and not registration.is_symlink()
    return {'folder_exists':root.is_dir(), 'installation_complete':all(exists.values()),
            'registration_file_present':registered, 'required_files':exists,
            'registered_online':None, 'status_source':'read-only-local-files',
            'warning':'A registration file is not proof of GitHub authentication or Online status.'}

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
    if name=='desktop.runner.inspect':
        if os.name!='nt':
            raise core.EngineError('Local GitHub runner inspection requires Windows.')
        root=(Path.home()/'Downloads'/'actions-runner' if args['location']=='user_downloads'
              else Path('C:/actions-runner'))
        result=_runner_probe(root)
        result['location']=args['location']
        return result
    if name.startswith('github.') or name in ('windows.powershell.inspect','windows.source.verify'):
        from engine import operator_tools
        return operator_tools.execute(name,args)
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
    name=row['capability']
    try:
        args=json.loads(row['args_json'])
        if not isinstance(args,dict):
            raise core.EngineError('Stored operator arguments must be an object.')
        clean=normalize(name,args)
        raw=json.dumps({'capability':name,'arguments':clean},sort_keys=True,separators=(',',':'))
        if hashlib.sha256(raw.encode()).hexdigest()!=digest:
            raise core.EngineError('Stored operator request changed after approval; refuse execution.')
        output=_execute(name,clean);result={'ok':True,'result':output};status='completed'
    except Exception as e:
        # GitHub might accept a dispatch even if the client loses its response.
        # Record uncertainty and require operator inspection; never auto-retry.
        uncertain=name in ('github.workflow.source_dispatch','windows.source.verify')
        result={'ok':False,'error':str(e)[:350]}
        if uncertain:
            result['execution_outcome']='unverified'
        status='needs_review' if uncertain else 'failed'
    # Avoid corrupting SQLite evidence with a truncated JSON string after an
    # operation has possibly run. Ambiguous outcomes are never auto-retried.
    try:
        serialized=json.dumps(result,ensure_ascii=False)
        byte_length=len(serialized.encode('utf-8'))
    except (TypeError,ValueError,UnicodeError):
        serialized=''
        byte_length=0
    if not serialized or byte_length>5000:
        result={'ok':False,'error':
                'Capability execution outcome is unverified: result evidence was '
                'unserializable or exceeded the audit limit. Inspect manually; do not retry automatically.',
                'execution_outcome':'unverified'}
        status='needs_review'
        serialized=json.dumps(result)
    with core.conn() as db:
        db.execute('UPDATE capability_requests SET status=?,updated=?,result_json=? WHERE id=?',
                   (status,int(time.time()),serialized,ident))
    core.audit('capability.'+status,{'id':ident,'capability':name})
    return {'id':ident,'status':status,**result}
