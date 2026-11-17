/* Display-only locale preference: no network calls, auth or tenant coupling. */
'use strict';
(() => {
  const LOCALES = Object.freeze([
    ['en-US','English'],['ar','العربية'],['bn','বাংলা'],['de','Deutsch'],
    ['es','Español'],['es-419','Español (Latinoamérica)'],['fil','Filipino'],
    ['fr','Français'],['hi','हिन्दी'],['id','Bahasa Indonesia'],
    ['it','Italiano'],['ja','日本語'],['ko','한국어'],
    ['pt-BR','Português (Brasil)'],['pt-PT','Português (Portugal)'],
    ['ru','Русский'],['sw','Kiswahili'],['tr','Türkçe'],
    ['ur','اردو'],['vi','Tiếng Việt'],['zh-CN','简体中文'],['zh-TW','繁體中文']
  ]);
  const AR = Object.freeze({
    'Overview':'نظرة عامة','AI Supervisor':'المشرف الذكي','Task queue':'قائمة المهام',
    'Code Studio':'استوديو البرمجة','Local models':'النماذج المحلية',
    'Workspace files':'ملفات مساحة العمل','Memory vault':'خزنة الذاكرة',
    'System & security':'النظام والأمان',
    'Supervisor Home':'الرئيسية','Local Services':'الخدمات المحلية',
    'AI Providers':'مزودو الذكاء الاصطناعي','Specialist Agents':'الوكلاء المتخصصون',
    'Audit & Deliveries':'التدقيق والتسليم'
  });
  const CODE_SET = new Set(LOCALES.map(([code]) => code));
  const KEY = 'theorg.ui.locale';
  const normalize = value => {
    if (typeof value !== 'string') return null;
    const tag = value.trim().replace(/_/g,'-').toLowerCase();
    if (tag.startsWith('en-gb') || tag === 'en') return 'en-US';
    if (tag.startsWith('ar-')) return 'ar';
    if (tag === 'zh-hant' || tag.startsWith('zh-hant-') || tag.startsWith('zh-hk') ||
        tag.startsWith('zh-mo')) return 'zh-TW';
    if (tag === 'zh' || tag.startsWith('zh-hans') || tag.startsWith('zh-sg')) return 'zh-CN';
    return LOCALES.find(([code]) => code.toLowerCase() === tag)?.[0] || null;
  };
  function start() {
    const host = document.querySelector('.topbar-right, .topbar .toolbar');
    if (!host || document.getElementById('ot-ui-locale')) return;
    const label = document.createElement('label');
    label.className = 'ui-locale-control';
    label.htmlFor = 'ot-ui-locale';
    const title = document.createElement('span');
    title.textContent = 'Language';
    const select = document.createElement('select');
    select.id = 'ot-ui-locale';
    select.setAttribute('aria-label','Interface language');
    for (const [code,name] of LOCALES) {
      const option = document.createElement('option');
      option.value = code; option.textContent = name;
      select.append(option);
    }
    const note = document.createElement('small');
    note.id = 'ot-ui-locale-note';
    note.setAttribute('role','status');
    const elements = [...document.querySelectorAll('[data-i18n-key]')];
    const apply = locale => {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';
      // Most UI content is still English; mark its language for assistive technology.
      document.body.lang = 'en';
      select.value = locale;
      for (const node of elements) {
        const source = node.getAttribute('data-i18n-key');
        node.textContent = locale === 'ar' ? (AR[source] || source) : source;
        node.setAttribute('lang',locale === 'ar' && AR[source] ? 'ar' : 'en');
      }
      note.lang = locale === 'ar' ? 'ar' : 'en';
      note.textContent = locale === 'en-US' ? '' : (locale === 'ar'
        ? 'ترجمة جزئية — قد تظهر بعض النصوص بالإنجليزية'
        : 'English fallback — full translation pending');
      try { localStorage.setItem(KEY,locale); } catch { /* optional storage */ }
    };
    label.append(title, select, note);
    host.prepend(label);
    let saved = null;
    try { saved = normalize(localStorage.getItem(KEY)); } catch { /* optional storage */ }
    apply(saved && CODE_SET.has(saved) ? saved : 'en-US');
    select.addEventListener('change', () => {
      if (CODE_SET.has(select.value)) apply(select.value);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
