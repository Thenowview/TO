"""Optional disposable local HTML inspection; never opens user profiles or the Internet."""
from __future__ import annotations
import os,secrets
from pathlib import Path
from engine import core

ACTIONS={'click','fill','text','screenshot'}
def validate(relative,steps):
    if type(relative) is not str or not relative.lower().endswith(('.html','.htm')):
        raise core.EngineError('Only workspace HTML files are accepted.')
    if type(steps) is not list or not 1<=len(steps)<=8:
        raise core.EngineError('Provide between one and eight steps.')
    source=core.workspace_path(relative)
    if source.is_symlink() or not source.is_file() or source.stat().st_size>131072:
        raise core.EngineError('Missing, linked or excessive HTML source.')
    for step in steps:
        if type(step) is not dict or step.get('action') not in ACTIONS:
            raise core.EngineError('Unapproved browser action.')
        kind=step['action']
        keys={'action'} if kind=='screenshot' else {'action','selector'}
        if kind=='fill':keys.add('value')
        if set(step)!=keys:raise core.EngineError('Unexpected browser step arguments.')
        if kind!='screenshot':
            selector=step['selector']
            if type(selector) is not str or not 1<=len(selector)<=180 or any(ord(x)<32 for x in selector):
                raise core.EngineError('Invalid CSS selector.')
        if kind=='fill' and (type(step['value']) is not str or len(step['value'])>1000):
            raise core.EngineError('Field value too large.')
    return source

def inspect(relative,steps):
    source=validate(relative,steps)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise core.EngineError('Optional Playwright is missing; no browser launched.') from e
    result=[];preview=None
    try:
        with sync_playwright() as p:
            binary=os.getenv('THEORG_CHROMIUM_PATH','').strip()
            if binary and not Path(binary).is_file():
                raise core.EngineError('Configured Chromium executable not found.')
            opts={'executable_path':binary} if binary else {}
            browser=p.chromium.launch(headless=True,timeout=15000,**opts)
            try:
                context=browser.new_context(offline=True,java_script_enabled=False,
                                            accept_downloads=False,service_workers='block',
                                            viewport={'width':1024,'height':768})
                context.route('**/*',lambda r:r.abort())
                page=context.new_page();page.set_default_timeout(3000)
                page.set_content(source.read_text(encoding='utf-8'),wait_until='domcontentloaded',timeout=5000)
                for step in steps:
                    if page.url!='about:blank':raise core.EngineError('Navigation blocked in offline preview.')
                    kind=step['action']
                    if kind=='screenshot':
                        folder=core.DATA/'browser-previews';folder.mkdir(parents=True,exist_ok=True)
                        preview=folder/('preview-'+secrets.token_hex(8)+'.png')
                        page.screenshot(path=str(preview),animations='disabled',timeout=6000)
                        if preview.stat().st_size>1500000:
                            preview.unlink(missing_ok=True)
                            raise core.EngineError('Screenshot exceeds output limit.')
                        result.append({'action':kind,'saved':preview.name})
                    else:
                        loc=page.locator(step['selector'])
                        if loc.count()!=1:raise core.EngineError('CSS selector must match exactly one element.')
                        if kind=='click':
                            loc.click();result.append({'action':kind,'clicked':True})
                        elif kind=='fill':
                            if loc.get_attribute('type')=='password':
                                raise core.EngineError('Password fields are prohibited.')
                            loc.fill(step['value']);result.append({'action':kind,'filled':True})
                        else:result.append({'action':kind,'text':loc.inner_text()[:1600]})
                context.close()
            finally:browser.close()
    except core.EngineError:raise
    except Exception as e:raise core.EngineError('Offline browser preview failed: '+str(e)[:250]) from e
    core.audit('browser.disposable_preview',{'file':relative,'steps':len(steps)})
    return {'offline':True,'javascript':False,'network_access':False,'actions':result,
            'screenshot_file':preview.name if preview else None,'verified_scope':'local-html-only'}
