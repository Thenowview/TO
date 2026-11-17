'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..','apps','chrome-extension');
const script = fs.readFileSync(path.join(root,'ui-locale.js'),'utf8');
const page = fs.readFileSync(path.join(root,'home.html'),'utf8');
test('Chrome supervisor preserves 22 selectable display locales and explicit English fallback', () => {
 const options = script.slice(script.indexOf('const LOCALES'),script.indexOf('const CODE_SET'));
 const codes = [...options.matchAll(/\['([^']+)','[^']+'\]/g)].map(x=>x[1]);
 assert.equal(codes.length,22);
 assert.equal(new Set(codes).size,22);
 for (const code of ['ar','ur','zh-CN','zh-TW','es-419','pt-BR','pt-PT']) assert.ok(codes.includes(code),code);
 assert.match(script,/English fallback — full translation pending/);
 assert.match(script,/ترجمة جزئية/);
 assert.match(script,/locale === 'ar' \|\| locale === 'ur' \? 'rtl' : 'ltr'/);
});
test('Chrome selector is safe, local-only, accessible and installed before home logic', () => {
 assert.ok(page.indexOf('src="ui-locale.js"') < page.indexOf('src="home.js"'));
 assert.equal((page.match(/data-i18n-key=/g)||[]).length,5);
 assert.match(script,/localStorage.setItem\(KEY,locale\)/);
 assert.match(script,/setAttribute\('aria-label','Interface language'\)/);
 assert.doesNotMatch(script,/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|innerHTML|eval)\s*\(/);
});
