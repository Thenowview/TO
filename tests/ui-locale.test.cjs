/* Static locale UI contract tests; browser/device acceptance is separate. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ext=fs.readFileSync(path.join(root,'apps/chrome-extension/ui-locale.js'),'utf8');
const desk=fs.readFileSync(path.join(root,'offline_desktop/static/ui-locale.js'),'utf8');
const extHtml=fs.readFileSync(path.join(root,'apps/chrome-extension/home.html'),'utf8');
const deskHtml=fs.readFileSync(path.join(root,'offline_desktop/static/index.html'),'utf8');
test('desktop and Chrome extension use identical local-only locale logic',()=>{
 assert.equal(ext,desk);
 assert.match(ext,/const KEY = 'theorg.ui.locale'/);
 assert.match(ext,/localStorage.setItem\(KEY,locale\)/);
 assert.doesNotMatch(ext,/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/);
 assert.doesNotMatch(ext,/\binnerHTML\b|\beval\s*\(/);
});
test('22 languages and Arabic/Urdu RTL are available without claiming full translation',()=>{
 const section=ext.slice(ext.indexOf('const LOCALES ='),ext.indexOf('const CODE_SET ='));
 const names=[...section.matchAll(/\['([^']+)','[^']+'\]/g)].map(x=>x[1]);
 assert.equal(names.length,22);
 assert.equal(new Set(names).size,22);
 assert.ok(names.includes('ar')&&names.includes('ur')&&names.includes('zh-CN')&&names.includes('zh-TW'));
 assert.match(ext,/locale === 'ar' \|\| locale === 'ur' \? 'rtl' : 'ltr'/);
 assert.match(ext,/English fallback — full translation pending/);
 assert.match(ext,/ترجمة جزئية/);
});
test('both UIs load the script and expose labelled navigation',()=>{
 assert.match(extHtml,/<script src="ui-locale.js" defer><\/script>/);
 assert.match(deskHtml,/<script src="\/ui-locale.js" defer><\/script>/);
 assert.equal((extHtml.match(/data-i18n-key=/g)||[]).length,5);
 assert.equal((deskHtml.match(/data-i18n-key=/g)||[]).length,8);
 assert.match(ext,/select.setAttribute\('aria-label','Interface language'\)/);
});
