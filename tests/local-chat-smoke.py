"""Exercises the published host, with an explicitly synthetic loopback model service."""
import http.server
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import threading
import time
import uuid
from windows_smoke_paths import bridge_workspace

class Model(http.server.BaseHTTPRequestHandler):
    contexts = []
    def log_message(self, *args): pass
    def do_GET(self):
        self.send_response(200); self.end_headers()
        self.wfile.write(b'{"models":[{"name":"synthetic-mini"}]}')
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        Model.contexts.append(body)
        self.send_response(200); self.send_header('Content-Type', 'application/x-ndjson'); self.end_headers()
        for packet in ({'message': {'content': 'Synthetic '}}, {'message': {'content': 'reply'}, 'done': True}):
            self.wfile.write((json.dumps(packet)+'\n').encode()); self.wfile.flush(); time.sleep(.15)

server = http.server.ThreadingHTTPServer(('127.0.0.1', 11434), Model)
threading.Thread(target=server.serve_forever, daemon=True).start()
exe = Path(sys.argv[1]).resolve()
process = subprocess.Popen([str(exe)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
company = 'chat_ci_' + uuid.uuid4().hex[:12]
def call(command, **fields):
    payload = json.dumps({'command': command, **fields}).encode()
    process.stdin.write(struct.pack('<I', len(payload)) + payload); process.stdin.flush()
    header = process.stdout.read(4); assert len(header) == 4, process.stderr.read().decode()
    return json.loads(process.stdout.read(struct.unpack('<I', header)[0]))
try:
    order = call('submit_order', companyId=company, instruction='Synthetic local chat job')['order']['orderId']
    other = call('submit_order', companyId=company, instruction='Separate job')['order']['orderId']
    scope = {'companyId': company, 'orderId': order}
    assert call('chat_models')['models'] == ['synthetic-mini']
    assert call('chat_memory_put', **scope, key='fixture', content='Only job one', source='synthetic')['ok']
    assert call('chat_memory_list', companyId=company, orderId=other)['notes'] == []
    nonce = uuid.uuid4().hex
    start = call('chat_start', **scope, text='Hello', model='synthetic-mini', nonce=nonce)
    assert start['ok'] and not start['jobCompleted'], start
    duplicate = call('chat_start', **scope, text='Hello', model='synthetic-mini', nonce=nonce)
    assert duplicate['duplicate'] and duplicate['turnId'] == start['turnId']
    deadline = time.time() + 15
    while time.time() < deadline:
        result = call('chat_get', **scope)
        if result['turns'][0]['status'] != 'running': break
        time.sleep(.1)
    assert result['turns'][0]['status'] == 'reply_ready', result
    assert result['messages'][-1]['content'] == 'Synthetic reply', result
    assert not result['jobCompleted']
    assert call('chat_get', companyId=company, orderId=other)['messages'] == []
    assert not call('chat_get', companyId='foreign', orderId=order)['ok']
    assert len(Model.contexts) == 1, 'Duplicate request reached the model'
    assert any('Only job one' in item['content'] for item in Model.contexts[0]['messages'])
    print('PASS actual host: streamed reply, persistent history, nonce deduplication and per-job memory isolation; model is SYNTHETIC')
finally:
    process.stdin.close()
    try: process.wait(timeout=10)
    except subprocess.TimeoutExpired: process.kill(); process.wait()
    server.shutdown(); server.server_close()
    shutil.rmtree(bridge_workspace() / 'companies' / company, ignore_errors=True)
