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


def test_overview_translations_cover_four_locales_and_accessible_controls():
    import json
    import re
    js = (STATIC / "i18n.js").read_text(encoding="utf-8")
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    keys = json.loads(re.search(r"const keys = (\\[.*?\\]);", js).group(1))
    columns = json.loads(re.search(r"const columns = (\\{.*?\\});", js).group(1))
    assert len(keys) >= 28
    assert len(keys) == len(set(keys))
    assert set(columns) == {"ar", "ur", "fr", "de"}
    for locale, values in columns.items():
        assert len(values) == len(keys), locale
        assert all(isinstance(value, str) and value.strip() for value in values), locale
    assert html.count('data-i18n="') >= 25
    assert 'data-i18n-aria="Interface language"' in html
    assert 'data-i18n-aria="Toggle navigation"' in html
    assert 'data-i18n-title="Refresh"' in html
    assert "setAttribute('aria-label', tr(el.dataset.i18nAria))" in js
    assert "setAttribute('title', tr(el.dataset.i18nTitle))" in js
