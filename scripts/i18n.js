// Secure Profile Lock — i18n helper for extension pages.
//
// By default strings come from chrome.i18n (browser UI language). The user
// can override the language manually (unlock/setup/options pages have a
// selector); the choice is stored in chrome.storage.local and the matching
// _locales/<lang>/messages.json is loaded directly.
//
// Usage in HTML:
//   <span data-i18n="msgKey">fallback</span>
//   <input data-i18n-placeholder="msgKey">
//   <button data-i18n-aria="msgKey">
//   <body data-i18n-title="msgKey">   → sets document.title to "<msg> — <appName>"
//   <select id="langSelect">          → wired up automatically as the language switcher
//
// In scripts: await i18nReady, then t('msgKey') or t('msgKey', substitution) —
// %s in the message is replaced with the substitution.

const LANG_KEY = 'secure_profile_lang';

let i18nDict = null; // null → fall back to chrome.i18n

function t(key, sub) {
  let msg = i18nDict ? i18nDict[key] || '' : chrome.i18n.getMessage(key) || '';
  if (sub !== undefined) msg = msg.replace('%s', String(sub));
  return msg;
}

async function loadI18n() {
  try {
    const data = await chrome.storage.local.get(LANG_KEY);
    const lang = data[LANG_KEY];
    if (lang && lang !== 'auto') {
      const res = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
      const json = await res.json();
      i18nDict = {};
      for (const [key, value] of Object.entries(json)) i18nDict[key] = value.message;
    }
  } catch (e) {
    i18nDict = null; // fall back to the browser language
  }
}

const i18nReady = loadI18n();

function applyI18n() {
  document.documentElement.lang = t('htmlLang') || 'en';

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const msg = t(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const msg = t(el.dataset.i18nPlaceholder);
    if (msg) el.placeholder = msg;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const msg = t(el.dataset.i18nAria);
    if (msg) el.setAttribute('aria-label', msg);
  });

  const titleKey = document.body && document.body.dataset.i18nTitle;
  if (titleKey) {
    const page = t(titleKey);
    if (page) document.title = `${page} — ${t('appName') || 'Secure Profile Lock'}`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await i18nReady;
  applyI18n();

  const select = document.getElementById('langSelect');
  if (select) {
    try {
      const data = await chrome.storage.local.get(LANG_KEY);
      select.value = data[LANG_KEY] || 'auto';
      if (select.selectedIndex === -1) select.value = 'auto';
    } catch (e) {
      select.value = 'auto';
    }
    select.addEventListener('change', async () => {
      await chrome.storage.local.set({ [LANG_KEY]: select.value });
      location.reload();
    });
  }
});
