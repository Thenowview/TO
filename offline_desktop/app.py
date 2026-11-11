#!/usr/bin/env python3
"""TheOrg Offline Engine local API and offline-first dashboard (Python stdlib)."""
from __future__ import annotations
import hmac, json, mimetypes, os, ipaddress, threading, time, urllib.parse, webbrowser, sys, subprocess, shutil, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from engine import core, coding, autopilot, coordination, capabilities

STATIC = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent)) / 'static'
TOKEN = None

class Handler(BaseHTTPRequestHandler):
    server_version = 'TheOrgOffline/0.10'
    def log_message(self, fmt, *args):
        print('[api]',self.address_string(),fmt % args)
    def _headers(self,status,mime='application/json; charset=utf-8',size=None):
        self.send_response(status)
        self.send_header('Content-Type',mime)
        if size is not None:self.send_header('Content-Length',str(size))
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('Cache-Control','no-store' if self.path.startswith('/api/') else 'no-cache')
        self.send_header('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
    def _json(self,data,status=200):
        raw=json.dumps(data,ensure_ascii=False).encode('utf-8')
        self._headers(status,size=len(raw));self.wfile.write(raw)
    def _safe_host(self):
        host=self.headers.get('Host','').split(':')[0].strip('[]')
        if host in ('localhost','127.0.0.1','::1'): return True
        if os.environ.get('THEORG_ALLOW_LAN_HTTP')!='1': return False
        try: return ipaddress.ip_address(host).is_private
        except ValueError: return False
    def _auth(self):
        if not self._safe_host():
            self._json({'error':'Local/private IP host required.'},403);return False
        if not hmac.compare_digest(self.headers.get('Authorization',''), 'Bearer '+TOKEN):
            self._json({'error':'Access token required; enter token from data/access-token.txt.'},401);return False
        return True
    def do_GET(self):
        path=urllib.parse.urlsplit(self.path).path
        if path.startswith('/api/'):
            if not self._auth():return
            try:
                if path=='/api/status':
                    backend,model=core.active_backend()
                    with core.conn() as db:
                        counts={r['status']:r['n'] for r in db.execute('SELECT status,count(*) n FROM tasks GROUP BY status')}
                    self._json({'ok':True,'offline':True,'name':'TheOrg Offline Engine','version':'0.10.0',
                        'active_backend':backend,'active_model':model,'llama_binary':bool(core.llama_binary()),
                        'model_files':len(core.local_models()),'tasks':counts,
                        'portable':bool(core.FROZEN or os.getenv('THEORG_PORTABLE')=='1'), 'workspace_files':len(core.list_files()),'memory_count':len(core.memories()),
                        'coding_projects':len(core.records('SELECT id FROM code_projects')),'coding_git_available':core.git_binary() is not None})
                elif path=='/api/models':
                    self._json({'files':core.local_models(),'backends':core.available_backends(),
                       'selected':core.setting('backend','auto'),
                       'ollama_model':core.setting('ollama_model',''),
                       'llama_binary':core.llama_binary() is not None,'model_directory':str(core.MODELS)})
                elif path=='/api/agents/reviews':self._json({'reviews':coordination.list_reviews()})
                elif path=='/api/capabilities':self._json({'capabilities':capabilities.catalog()})
                elif path=='/api/capabilities/history':self._json({'requests':capabilities.history()})
                elif path=='/api/tasks':self._json({'tasks':core.tasks()})
                elif path=='/api/memories':self._json({'memories':core.memories()})
                elif path=='/api/files':self._json({'files':core.list_files()})
                elif path=='/api/profiles':self._json({'profiles':[{'id':k,'name':v[0]} for k,v in core.PROFILES.items()]})
                elif path=='/api/audit':self._json({'events':core.records('SELECT * FROM audit ORDER BY id DESC LIMIT 30')})
                elif path=='/api/code/projects':self._json({'projects':coding.list_projects()})
                elif path=='/api/code/plans':self._json({'plans':coding.list_plans()})
                elif path=='/api/code/plan':
                    ident=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get('id',[''])[0]
                    self._json({'plan':coding.get_plan(ident)})
                elif path=='/api/code/files':
                    ident=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get('project_id',[''])[0]
                    self._json({'files':coding.project_files(ident)})
                elif path=='/api/code/context':
                    q=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                    self._json(coding.project_context(q.get('project_id',[''])[0],q.get('objective',[''])[0]))
                elif path=='/api/code/search':
                    q=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                    self._json(coding.project_search(q.get('project_id',[''])[0],q.get('q',[''])[0]))
                elif path=='/api/code/sandbox':
                    self._json({'sandbox':coding.sandbox_status(),
                                'trusted_local_opt_in':os.environ.get('THEORG_ALLOW_TRUSTED_TESTS')=='1'})
                elif path=='/api/code/autopilot':
                    self._json({'runs':autopilot.list_runs()})
                elif path=='/api/code/history':
                    q=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                    self._json(coding.project_history(q.get('project_id',[''])[0]))
                else:self._json({'error':'Unknown API endpoint.'},404)
            except Exception as e:self._json({'error':str(e)},500)
            return
        if path=='/':path='/index.html'
        try:
            p=(STATIC/path.lstrip('/')).resolve()
            if not p.is_relative_to(STATIC.resolve()) or not p.is_file(): raise FileNotFoundError()
            raw=p.read_bytes()
            mime=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
            if p.suffix=='.webmanifest':mime='application/manifest+json'
            self._headers(200,mime,size=len(raw));self.wfile.write(raw)
        except (OSError,ValueError):self._headers(404,'text/plain',size=9);self.wfile.write(b'Not found')
    def do_POST(self):
        path=urllib.parse.urlsplit(self.path).path
        if not path.startswith('/api/'):
            self._json({'error':'Unknown endpoint.'},404);return
        if not self._auth():return
        try:
            n=int(self.headers.get('Content-Length','0'))
            if path in ('/api/models/import','/api/models/import-zip'):
                if self.headers.get('X-TheOrg-Confirm') != 'import':
                    raise core.EngineError('Explicit local model import required.')
                if self.headers.get('Content-Type') not in ('application/octet-stream','application/zip'):
                    raise core.EngineError('Binary GGUF or ZIP content type required.')
                name=urllib.parse.unquote(self.headers.get('X-TheOrg-Model-Name',''))
                importer=core.import_model_zip_stream if path.endswith('import-zip') else core.import_model_stream
                self._json({'ok':True,**importer(name,self.rfile,n)},201)
                return
            if not 0<n<=150000:
                self._json({'error':'Payload must be between 1 byte and 150 KB.'},413);return
            payload=json.loads(self.rfile.read(n).decode('utf-8'))
            if not isinstance(payload,dict):raise core.EngineError('Request body must be an object.')
            if path=='/api/tasks':
                ident=core.enqueue(payload.get('prompt'),payload.get('role','supervisor'))
                self._json({'ok':True,'id':ident},201)
            elif path=='/api/agents/reviews':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit advisory review approval required.')
                self._json({'review':coordination.create(payload.get('project_id'),payload.get('objective'),payload.get('scope'))},202)
            elif path=='/api/agents/reviews/resume':
                self._json({'review':coordination.resume(payload.get('id'),payload.get('confirmed'))})
            elif path=='/api/capabilities/prepare':
                self._json({'request':capabilities.prepare(payload.get('capability'),payload.get('arguments',{}))},201)
            elif path=='/api/capabilities/execute':
                self._json(capabilities.approve_and_execute(payload.get('id'),payload.get('digest'),payload.get('confirmed')))
            elif path=='/api/agents/reviews/cancel':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit cancellation confirmation required.')
                self._json(coordination.cancel(payload.get('id')))
            elif path=='/api/tasks/cancel':
                core.cancel_task(payload.get('id'));self._json({'ok':True})
            elif path=='/api/memories':
                ident=core.add_memory(payload.get('title'),payload.get('content'));self._json({'ok':True,'id':ident},201)
            elif path=='/api/memories/delete':
                core.delete_memory(payload.get('id'));self._json({'ok':True})
            elif path=='/api/files/read':
                self._json({'name':payload.get('name'),'content':core.read_file(payload.get('name'))})
            elif path=='/api/files/write':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit file-write confirmation required.')
                self._json({'ok':True,**core.write_file(payload.get('name'),payload.get('content'))})
            elif path=='/api/code/projects':
                if payload.get('confirmed') is not True:raise core.EngineError('Project creation needs explicit confirmation.')
                self._json({'project':coding.create_project(payload.get('slug'))},201)
            elif path=='/api/code/files/read':
                self._json(coding.read_project_file(payload.get('project_id'),payload.get('path')))
            elif path=='/api/code/plans':
                self._json({'plan':coding.propose(payload.get('project_id'),payload.get('objective'),payload.get('changes'))},201)
            elif path=='/api/code/plans/generate':
                self._json({'plan':coding.generate_with_local_model(payload.get('project_id'),payload.get('objective'))},201)
            elif path=='/api/code/plans/repair':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit confirmation required to ask local AI for a repair proposal.')
                self._json({'plan':coding.generate_repair_with_local_model(payload.get('id'))},201)
            elif path=='/api/code/plans/review':
                if payload.get('confirmed') is not True:raise core.EngineError('Request an advisory AI review explicitly.')
                self._json({'plan':coding.review_plan_with_local_model(payload.get('id'))})
            elif path=='/api/code/plans/approve':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit plan approval is required.')
                self._json({'plan':coding.approve(payload.get('id'),payload.get('digest'))})
            elif path=='/api/code/plans/apply':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit apply confirmation is required.')
                self._json({'plan':coding.apply(payload.get('id'))})
            elif path=='/api/code/plans/verify':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit test approval is required; tests execute local project code.')
                self._json({'plan':coding.verify(payload.get('id'),run_tests=payload.get('run_tests') is True,
                                        execution_mode=payload.get('execution_mode','sandbox'))})
            elif path=='/api/code/plans/rollback':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit rollback confirmation is required.')
                self._json({'plan':coding.rollback(payload.get('id'))})
            elif path=='/api/code/plans/commit':
                if payload.get('confirmed') is not True:raise core.EngineError('Local Git commit needs separate explicit approval.')
                self._json({'plan':coding.commit(payload.get('id'),payload.get('message'))})
            elif path=='/api/code/autopilot/cancel':
                if payload.get('confirmed') is not True: raise core.EngineError('Explicit Autopilot cancellation requested.')
                self._json({'ok':True,**autopilot.request_cancel(payload.get('id'))})
            elif path=='/api/code/autopilot':
                if payload.get('confirmed') is not True: raise core.EngineError('Explicit scoped Autopilot authorization required.')
                self._json({'run':autopilot.authorize(payload.get('project_id'),payload.get('objective'),payload.get('approval_scope'),payload.get('max_attempts',2))},202)
            elif path=='/api/models/select':
                backend=payload.get('backend')
                if backend not in ('auto','llamacpp'):
                    raise core.EngineError('Only local model backends supported.')
                core.set_setting('backend',backend)
                name=payload.get('ollama_model','')
                if not isinstance(name,str) or len(name)>100:raise core.EngineError('Invalid model name.')
                if name:core.set_setting('ollama_model',name)
                core.audit('models.select',{'backend':backend,'ollama_model':name})
                self._json({'ok':True})
            elif path=='/api/models/benchmark':
                if payload.get('confirmed') is not True:
                    raise core.EngineError('Explicit confirmation required to benchmark a local model.')
                self._json({'benchmark':core.benchmark_local_model()})
            elif path=='/api/models/preflight':
                self._json({'preflight':core.model_start_preflight(payload.get('name'))})
            elif path=='/api/models/probe':
                if payload.get('confirmed') is not True:
                    raise core.EngineError('Explicit confirmation required for live local-model inference test.')
                self._json({'probe':core.probe_local_model()})
            elif path=='/api/code/projects/bundle':
                if payload.get('confirmed') is not True:
                    raise core.EngineError('Explicit offline Git export confirmation required.')
                self._json({'bundle':coding.export_git_bundle(payload.get('project_id'))},201)
            elif path=='/api/models/stop':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit model-stop confirmation required.')
                self._json({'ok':True,**core.stop_local_model()})
            elif path=='/api/models/start':
                if payload.get('confirmed') is not True:raise core.EngineError('Explicit model-start confirmation required.')
                self._json({'ok':True,**core.start_local_model(payload.get('name'))})
            else:self._json({'error':'Unknown API endpoint.'},404)
        except (json.JSONDecodeError,UnicodeDecodeError,ValueError,core.EngineError) as e:
            self._json({'error':str(e)},400)
        except Exception as e:
            self._json({'error':'Engine error: '+str(e)},500)

def _show_error(message):
    if os.name == 'nt':
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, str(message), 'TheOrg Offline Engine', 0x10)
            return
        except Exception:
            pass
    print(message, file=sys.stderr)


def _open_dashboard(url):
    """Use the user's DEFAULT browser (Chrome if chosen in Windows settings)."""
    webbrowser.open(url, new=1)


def _create_desktop_shortcut_if_needed():
    """Optional convenience only: no installer, registry, startup task or admin rights."""
    if os.name != 'nt' or not getattr(sys, 'frozen', False):
        return
    if os.environ.get('THEORG_SKIP_SHORTCUT') == '1':
        return
    # PowerShell is present on supported Windows versions; abort harmlessly on failure.
    script = r'''
$desktop=[Environment]::GetFolderPath('Desktop')
$shortcut=Join-Path $desktop 'TheOrg.lnk'
if (-not (Test-Path -LiteralPath $shortcut)) {
  $ws=New-Object -ComObject WScript.Shell
  $link=$ws.CreateShortcut($shortcut)
  $link.TargetPath='__THEORG_EXE_PATH__'
  $link.WorkingDirectory=Split-Path -Parent '__THEORG_EXE_PATH__'
  $link.Description='TheOrg portable offline workspace'
  $link.Save()
}
'''
    script=script.replace('__THEORG_EXE_PATH__',str(Path(sys.executable).resolve()).replace("'","''"))
    try:
        subprocess.run(['powershell.exe','-NoLogo','-NoProfile','-NonInteractive',
                        '-Command',script],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,timeout=8,check=False)
    except (OSError,subprocess.TimeoutExpired):
        pass


def _test_worker():
    """Execute approved project tests as a child process in the project's cwd.

    This is not a sandbox. Only a separately confirmed Code Studio action
    may launch it, and the parent imposes a strict subprocess timeout.
    """
    import unittest, io
    report = io.StringIO()
    if sys.stdout is None: sys.stdout = report
    if sys.stderr is None: sys.stderr = report
    try:
        suite = unittest.TestLoader().discover(start_dir='tests', pattern='test*.py', top_level_dir='.')
        result = unittest.TextTestRunner(stream=report, verbosity=2).run(suite)
        passed = result.wasSuccessful()
    except Exception as exc:
        print('Test runner could not initialize:', exc, file=report)
        passed = False
    path = os.environ.get('THEORG_TEST_REPORT')
    if path:
        Path(path).write_text(report.getvalue()[-24000:], encoding='utf-8')
    return 0 if passed else 1


def main():
    global TOKEN
    import argparse
    parser=argparse.ArgumentParser(description='TheOrg Offline Engine — local-first')
    parser.add_argument('--host',default='127.0.0.1',help='Localhost only by default; LAN opt-in requires THEORG_ALLOW_LAN_HTTP=1')
    parser.add_argument('--port',type=int,default=int(os.getenv('THEORG_PORT','8765')))
    parser.add_argument('--no-browser',action='store_true')
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--benchmark-model',action='store_true',help='Run real local structured-output benchmark; exit nonzero unless passed')
    args=parser.parse_args()
    if getattr(sys, 'frozen', False) and sys.stdout is None:
        core.DATA.mkdir(parents=True,exist_ok=True)
        sys.stdout = open(core.DATA/'engine.log','a',encoding='utf-8',buffering=1)
        sys.stderr = sys.stdout
    if args.benchmark_model:
        TOKEN=core.init()
        coding.init_schema()
        autopilot.init_schema()
        coordination.init_schema()
        capabilities.init_schema()
        try:
            outcome=core.benchmark_local_model()
            print(json.dumps(outcome,ensure_ascii=False))
            return 0 if outcome['structured_output_pass'] else 3
        except core.EngineError as exc:
            print('BENCHMARK UNAVAILABLE: '+str(exc),file=sys.stderr)
            return 3
    if args.self_test:
        import unittest
        assert (STATIC/'index.html').is_file(), 'Dashboard asset missing'
        assert (STATIC/'app.js').is_file(), 'Dashboard script missing'
        assert (STATIC/'style.css').is_file(), 'Dashboard CSS missing'
        assert len(core.PROFILES)==12, 'Missing agent profiles'
        TOKEN=core.init()
        coding.init_schema()
        autopilot.init_schema()
        coordination.init_schema()
        capabilities.init_schema()
        print('PASS bundled dashboard, engine, SQLite and role registry')
        return 0
    TOKEN=core.init()
    coding.init_schema()
    autopilot.init_schema()
    coordination.init_schema()
    capabilities.init_schema()
    _create_desktop_shortcut_if_needed()
    if args.host not in ('127.0.0.1','::1','localhost'):
        if os.environ.get('THEORG_ALLOW_LAN_HTTP')!='1':
            _show_error('LAN HTTP exposure disabled by default. Use localhost, or set THEORG_ALLOW_LAN_HTTP=1 after assessing the risk.')
            return 2
        print('WARNING: LAN HTTP is unencrypted. Do not port-forward or use on untrusted networks.')
    worker=core.QueueWorker()
    # Bind before opening the browser so a second click can never send the
    # token fragment to an unexpected local service on a reserved port.
    try:
        server=ThreadingHTTPServer((args.host,args.port),Handler)
    except OSError as exc:
        _show_error('TheOrg could not bind its local dashboard port. It may already be running.\n\n'+str(exc))
        return 1
    server.daemon_threads=True
    worker.start()
    url=f'http://127.0.0.1:{args.port}/#theorg-token={urllib.parse.quote(TOKEN, safe="")}'
    print('TheOrg Portable Engine 0.10 — local only')
    print('Local URL: http://127.0.0.1:'+str(args.port))
    print('Workspace:',core.WORKSPACE)
    if not args.no_browser:
        threading.Timer(.7,lambda:_open_dashboard(url)).start()
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        worker.stop.set()
        core.stop_local_model()
        server.server_close()
    return 0


if __name__=='__main__':
    if '--theorg-run-approved-tests' in sys.argv[1:]:
        sys.exit(_test_worker())
    try:
        sys.exit(main())
    except Exception as exc:
        _show_error('TheOrg could not start: '+str(exc))
        sys.exit(1)
