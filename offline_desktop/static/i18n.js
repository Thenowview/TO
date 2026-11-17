/* Core navigation and overview translations. The remainder of the dashboard
 * intentionally stays English until its copy has been localized and reviewed. */
(function () {
  'use strict';
  const keys = ["Overview","AI Supervisor","Task queue","Code Studio","Local models","Workspace files","Memory vault","System & security","Workspace overview","Personal workspace","Local-first • Private","Offline by design","No cloud needed. Optional AI links require your choice.","LOCAL INTELLIGENCE SYSTEM","One workspace.","Every agent, locally.","Run compatible AI models, manage work, and keep your files and memories on your own device.","AI CONNECTION","TASKS COMPLETED","LOCAL FILES","SAVED MEMORIES","Quick actions","Live engine status","Connect to your engine","Local API token","Interface language","Toggle navigation","Refresh"];
  const columns = {"ar":["نظرة عامة","المشرف الذكي","قائمة المهام","استوديو البرمجة","النماذج المحلية","ملفات مساحة العمل","خزنة الذاكرة","النظام والأمان","نظرة عامة على مساحة العمل","مساحة العمل الشخصية","محلي أولا • خاص","مصمم للعمل دون اتصال","لا حاجة إلى السحابة. ربط خدمات الذكاء الاصطناعي اختياري.","نظام الذكاء المحلي","مساحة عمل واحدة.","جميع الوكلاء محليا.","شغل نماذج ذكاء اصطناعي متوافقة وأدر العمل واحتفظ بملفاتك وذاكرتك على جهازك.","اتصال الذكاء الاصطناعي","المهام المكتملة","الملفات المحلية","الذكريات المحفوظة","إجراءات سريعة","حالة المحرك المباشرة","الاتصال بالمحرك","رمز واجهة البرمجة المحلي","لغة الواجهة","تبديل القائمة","تحديث"],"ur":["جائزہ","اے آئی نگران","کاموں کی قطار","کوڈ اسٹوڈیو","مقامی ماڈلز","ورک اسپیس فائلیں","میموری والٹ","سسٹم اور سیکیورٹی","ورک اسپیس کا جائزہ","ذاتی ورک اسپیس","مقامی ترجیح • نجی","آف لائن استعمال کے لیے تیار","کلاؤڈ ضروری نہیں۔ اے آئی روابط اختیاری ہیں۔","مقامی ذہانت کا نظام","ایک ورک اسپیس۔","ہر ایجنٹ مقامی طور پر۔","مطابقت رکھنے والے اے آئی ماڈلز چلائیں، کام سنبھالیں، اور فائلیں اپنے آلے پر رکھیں۔","اے آئی کنکشن","مکمل کام","مقامی فائلیں","محفوظ یادداشتیں","فوری اقدامات","انجن کی موجودہ حالت","اپنے انجن سے جڑیں","مقامی API ٹوکن","انٹرفیس کی زبان","نیویگیشن کھولیں یا بند کریں","تازہ کریں"],"fr":["Vue d’ensemble","Superviseur IA","File des tâches","Studio de code","Modèles locaux","Fichiers de l’espace de travail","Coffre mémoire","Système et sécurité","Vue d’ensemble de l’espace de travail","Espace de travail personnel","Local avant tout • Privé","Conçu pour fonctionner hors ligne","Aucun cloud requis. Les connexions IA sont facultatives.","SYSTÈME D’INTELLIGENCE LOCAL","Un seul espace de travail.","Tous les agents, en local.","Exécutez des modèles IA compatibles, gérez le travail et gardez vos fichiers sur votre appareil.","CONNEXION IA","TÂCHES TERMINÉES","FICHIERS LOCAUX","MÉMOIRES ENREGISTRÉES","Actions rapides","État du moteur en direct","Connexion à votre moteur","Jeton API local","Langue de l’interface","Afficher ou masquer la navigation","Actualiser"],"de":["Übersicht","KI-Supervisor","Aufgabenwarteschlange","Code-Studio","Lokale Modelle","Arbeitsbereichsdateien","Speichertresor","System und Sicherheit","Arbeitsbereichübersicht","Persönlicher Arbeitsbereich","Lokal zuerst • Privat","Für Offline-Betrieb entwickelt","Keine Cloud nötig. KI-Verbindungen sind optional.","LOKALES INTELLIGENZSYSTEM","Ein Arbeitsbereich.","Alle Agenten, lokal.","Kompatible KI-Modelle ausführen, Arbeit verwalten und Dateien auf dem eigenen Gerät behalten.","KI-VERBINDUNG","ERLEDIGTE AUFGABEN","LOKALE DATEIEN","GESPEICHERTE ERINNERUNGEN","Schnellaktionen","Live-Engine-Status","Mit der Engine verbinden","Lokales API-Token","Oberflächensprache","Navigation ein-/ausblenden","Aktualisieren"]};
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
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', tr(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.setAttribute('title', tr(el.dataset.i18nTitle)); });
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
