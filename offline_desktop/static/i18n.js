/* Initial reviewed core-navigation translations. The remainder of the dashboard
 * intentionally stays English until its copy has been localized and reviewed. */
(function () {
  'use strict';
  const keys = ["Overview","AI Supervisor","Task queue","Code Studio","Local models","Workspace files","Memory vault","System & security","Workspace overview"];
  const columns = {"ar":["نظرة عامة","المشرف الذكي","قائمة المهام","استوديو البرمجة","النماذج المحلية","ملفات مساحة العمل","خزنة الذاكرة","النظام والأمان","نظرة عامة على مساحة العمل"],"ur":["جائزہ","اے آئی نگران","کاموں کی قطار","کوڈ اسٹوڈیو","مقامی ماڈلز","ورک اسپیس فائلیں","میموری والٹ","سسٹم اور سیکیورٹی","ورک اسپیس کا جائزہ"],"fr":["Vue d’ensemble","Superviseur IA","File des tâches","Studio de code","Modèles locaux","Fichiers de l’espace de travail","Coffre mémoire","Système et sécurité","Vue d’ensemble de l’espace de travail"],"de":["Übersicht","KI-Supervisor","Aufgabenwarteschlange","Code-Studio","Lokale Modelle","Arbeitsbereichsdateien","Speichertresor","System und Sicherheit","Arbeitsbereichübersicht"]};
  const supported = ['en','ar','ur','fr','de'];
  const normalize = value => {
    const language = String(value || '').trim().replace(/_/g, '-').toLowerCase().split('-')[0];
    return supported.includes(language) ? language : 'en';
  };
  const storageKey = 'orgaiz.offline.ui-language';
  let locale = 'en';
  try { locale = normalize(localStorage.getItem(storageKey)); } catch { /* private storage */ }
  const tr = (english) => {
    const index = keys.indexOf(english);
    return index < 0 || locale === 'en' ? english : columns[locale]?.[index] || english;
  };
  const apply = () => {
    document.documentElement.lang = locale;
    document.documentElement.dir = ['ar','ur'].includes(locale) ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
    const select = document.getElementById('uiLanguage');
    if (select) select.value = locale;
    const title = document.getElementById('pageTitle');
    if (title && title.dataset.i18nDynamic) title.textContent = tr(title.dataset.i18nDynamic);
  };
  window.OrgaizOfflineLocale = Object.freeze({
    translate: tr,
    current: () => locale,
    set: value => {
      locale = normalize(value);
      try { localStorage.setItem(storageKey, locale); } catch { /* private storage */ }
      apply();
    },
    apply
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('uiLanguage')?.addEventListener('change', event => window.OrgaizOfflineLocale.set(event.target.value));
    apply();
  });
})();
