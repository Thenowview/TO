"""Regression coverage for the offline desktop's opt-in UI localization assets."""
from pathlib import Path

STATIC = Path(__file__).resolve().parents[1] / "static"


def test_core_localization_asset_is_loaded_before_dashboard():
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    assert 'id="uiLanguage"' in html
    assert html.index('src="/i18n.js"') < html.index('src="/app.js"')
    assert html.count('data-i18n="') >= 9


def test_right_to_left_locales_and_safe_english_fallback():
    js = (STATIC / "i18n.js").read_text(encoding="utf-8")
    assert "['ar','ur'].includes(locale)" in js
    assert "supported.includes(language) ? language : 'en'" in js
    assert "columns[locale]?.[index] || english" in js
    assert "localStorage.setItem(storageKey, locale)" in js
    assert "document.documentElement.lang = locale" in js


def test_offline_cache_includes_localization_script():
    sw = (STATIC / "sw.js").read_text(encoding="utf-8")
    assert "'/i18n.js'" in sw
    assert "theorg-offline-ui-v3" in sw
    assert "u.pathname.startsWith('/api/')" in sw
