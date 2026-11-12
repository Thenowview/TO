"""Bounded, opt-in online answer adapter. Never sends files, memory or history.

Uses an existing owner-configured OpenAI API key/model. No account, key, paid
resource or subscription is created. Credentials stay in the process environment.
"""
from __future__ import annotations
import json
import os
import re
import urllib.error
import urllib.request

MAX_RESPONSE = 1_000_000
_SECRET = re.compile(r'-----BEGIN .*PRIVATE KEY-----|\b(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*\S+|\b(?:sk-|gh[pousr]_)[A-Za-z0-9_-]{16,}', re.I)


class ProviderUnavailable(ValueError):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ProviderUnavailable('Online provider redirects are not permitted.')


def status():
    provider = os.environ.get('THEORG_ONLINE_PROVIDER', '').strip().lower()
    model = os.environ.get('THEORG_ONLINE_MODEL', '').strip()
    configured = bool(provider == 'openai' and model and os.environ.get('OPENAI_API_KEY'))
    return {'provider': provider or None, 'model': model or None,
            'configured': configured, 'private_files_sent': False,
            'credentials_in_package': False,
            'note': 'Uses an existing authorized API configuration; browser subscriptions are not API credentials.'}


def has_probable_secret(text):
    return bool(_SECRET.search(text))


def complete(question, role, *, approved=False):
    if approved is not True:
        raise ProviderUnavailable('Enable online fallback before transmitting a question.')
    if not isinstance(question, str) or not 3 <= len(question.strip()) <= 12000:
        raise ProviderUnavailable('Invalid online question.')
    if has_probable_secret(question):
        raise ProviderUnavailable('Possible credentials in the question; keep this task local and redact them.')
    info = status()
    if not info['configured']:
        raise ProviderUnavailable('No authorized online API provider is configured.')
    body = {'model': info['model'], 'store': False, 'max_output_tokens': 1800,
            'tools': [{'type':'web_search'}],
            'instructions': 'Answer the current question. State uncertainty. Do not claim file access, code execution, tool use or task verification.',
            'input': question}
    request = urllib.request.Request('https://api.openai.com/v1/responses',
        data=json.dumps(body).encode('utf-8'), method='POST',
        headers={'Content-Type': 'application/json',
                 'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY']})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())
    try:
        with opener.open(request, timeout=90) as response:
            raw = response.read(MAX_RESPONSE + 1)
        if len(raw) > MAX_RESPONSE:
            raise ProviderUnavailable('Online response exceeded its size limit.')
        payload = json.loads(raw)
        if payload.get('status') != 'completed':
            raise ProviderUnavailable('Online response did not complete.')
        parts = [item.get('text', '') for message in payload.get('output', [])
                 if message.get('type') == 'message'
                 for item in message.get('content', []) if item.get('type') == 'output_text']
        answer = '\n'.join(parts).strip()
        if not 5 <= len(answer) <= 10000:
            raise ProviderUnavailable('Online provider returned no usable bounded answer.')
    except urllib.error.HTTPError as error:
        # Never expose request headers, credentials or arbitrary provider error bodies.
        raise ProviderUnavailable('Online provider returned HTTP ' + str(error.code)) from None
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        if isinstance(error, ProviderUnavailable):
            raise
        raise ProviderUnavailable('Online provider connection or response was invalid.') from None
    sources=[]
    for message in payload.get('output',[]):
        for part in message.get('content',[]) if message.get('type')=='message' else []:
            for annotation in part.get('annotations',[]):
                url=annotation.get('url','')
                if annotation.get('type')=='url_citation' and isinstance(url,str) and url.startswith('https://'):
                    sources.append({'url':url[:1000],'title':str(annotation.get('title',''))[:200]})
    if not sources:
        raise ProviderUnavailable('Online answer has no cited HTTPS sources; manual research/review is required.')
    answer+='\n\nSources:\n'+'\n'.join(s['url'] for s in sources[:10])
    if len(answer)>10000:
        raise ProviderUnavailable('Cited answer exceeded the bounded response size; shorten the research question.')
    return {'answer': answer, 'provider': info['provider'], 'model': info['model'], 'sources':sources[:10],
            'private_files_sent': False, 'history_sent': False, 'memory_sent': False,
            'independently_verified': False}
