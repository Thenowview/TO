import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const html=readFileSync(join(root,'index.html'),'utf8');
if (!html.includes('Synthetic data') || !html.includes('No connection to THEEPMO systems')) throw new Error('Unsafe or unlabeled site payload');
const code=`const html=${JSON.stringify(html)};
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        service: 'theorg-intelligence',
        mode: 'synthetic-demo',
        connected_agent_runtime: false,
        epmo_connected: false
      }, { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname !== '/' && url.pathname !== '/index.html') {
      return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        'cache-control': 'public, max-age=120'
      }
    });
  }
};
`;
const target=join(root,'dist','worker.mjs');
mkdirSync(dirname(target),{recursive:true});
writeFileSync(target,code,'utf8');
console.log('Generated standalone Worker:',target,'from index.html');
