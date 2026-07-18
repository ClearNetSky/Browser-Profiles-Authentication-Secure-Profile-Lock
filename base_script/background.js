// Secure Profile Lock — background service worker (Manifest V3)
//
// Storage layout (chrome.storage.local):
//   secure_profile_password        legacy plaintext password (migrated away on first run)
//   secure_profile_pwd_hash        base64 PBKDF2-SHA256 hash
//   secure_profile_pwd_salt        base64 random salt (16 bytes)
//   secure_profile_pwd_iterations  PBKDF2 iteration count used for the stored hash
//   secure_profile_hint            optional password hint (plaintext)
//   secure_profile_locked          boolean lock state
//   secure_profile_attempts        { count, lockedUntil } brute-force throttle state
//   secure_profile_settings        { clearOnLock, clearData{…}, idleLock, idleMinutes }
//   secure_profile_whatsnew        version string whose What's New page is pending

const LEGACY_PASSWORD_KEY = 'secure_profile_password';
const HASH_KEY = 'secure_profile_pwd_hash';
const SALT_KEY = 'secure_profile_pwd_salt';
const ITERATIONS_KEY = 'secure_profile_pwd_iterations';
const HINT_KEY = 'secure_profile_hint';
const LOCKED_KEY = 'secure_profile_locked';
const ATTEMPTS_KEY = 'secure_profile_attempts';
const SETTINGS_KEY = 'secure_profile_settings';
const WHATSNEW_KEY = 'secure_profile_whatsnew';

const PBKDF2_ITERATIONS = 310000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30 * 1000;

const UNLOCK_URL = chrome.runtime.getURL('html/unlock.html');
const SETUP_URL = chrome.runtime.getURL('html/password-setup.html');
const WHATSNEW_URL = chrome.runtime.getURL('html/whatsnew.html');

const DEFAULT_SETTINGS = {
  clearOnLock: false,
  clearData: {
    history: true,
    downloads: true,
    cache: false,
    cookies: false,
    formData: false
  },
  idleLock: false,
  idleMinutes: 10
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = data[SETTINGS_KEY] || {};
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    clearData: { ...DEFAULT_SETTINGS.clearData, ...(stored.clearData || {}) }
  };
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBytes(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function deriveHash(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    256
  );
  return bufferToBase64(bits);
}

async function storePassword(password, hint) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt, PBKDF2_ITERATIONS);
  await chrome.storage.local.set({
    [HASH_KEY]: hash,
    [SALT_KEY]: bufferToBase64(salt.buffer),
    [ITERATIONS_KEY]: PBKDF2_ITERATIONS,
    [HINT_KEY]: hint || ''
  });
  await chrome.storage.local.remove(LEGACY_PASSWORD_KEY);
}

async function hasPassword() {
  const data = await chrome.storage.local.get([HASH_KEY, LEGACY_PASSWORD_KEY]);
  return Boolean(data[HASH_KEY] || data[LEGACY_PASSWORD_KEY]);
}

async function checkPassword(input) {
  const data = await chrome.storage.local.get([
    HASH_KEY,
    SALT_KEY,
    ITERATIONS_KEY,
    LEGACY_PASSWORD_KEY
  ]);
  if (data[HASH_KEY] && data[SALT_KEY]) {
    const hash = await deriveHash(
      input,
      base64ToBytes(data[SALT_KEY]),
      data[ITERATIONS_KEY] || PBKDF2_ITERATIONS
    );
    return hash === data[HASH_KEY];
  }
  if (data[LEGACY_PASSWORD_KEY]) {
    return input === data[LEGACY_PASSWORD_KEY];
  }
  return false;
}

// Users upgrading from 1.x have a plaintext password in storage — replace it
// with a salted hash without changing the hint or lock state.
async function migrateLegacyPassword() {
  const data = await chrome.storage.local.get([LEGACY_PASSWORD_KEY, HASH_KEY, HINT_KEY]);
  if (data[LEGACY_PASSWORD_KEY] && !data[HASH_KEY]) {
    await storePassword(data[LEGACY_PASSWORD_KEY], data[HINT_KEY]);
  }
}

// ---------------------------------------------------------------------------
// Brute-force throttling
// ---------------------------------------------------------------------------

async function getAttempts() {
  const data = await chrome.storage.local.get(ATTEMPTS_KEY);
  return data[ATTEMPTS_KEY] || { count: 0, lockedUntil: 0 };
}

async function verifyWithThrottle(input) {
  const attempts = await getAttempts();
  const now = Date.now();
  if (attempts.lockedUntil > now) {
    return { ok: false, cooldownMs: attempts.lockedUntil - now, attemptsLeft: 0 };
  }

  const valid = await checkPassword(input || '');
  if (valid) {
    await chrome.storage.local.remove(ATTEMPTS_KEY);
    return { ok: true };
  }

  attempts.count += 1;
  if (attempts.count >= MAX_ATTEMPTS) {
    attempts.count = 0;
    attempts.lockedUntil = now + COOLDOWN_MS;
    await chrome.storage.local.set({ [ATTEMPTS_KEY]: attempts });
    return { ok: false, cooldownMs: COOLDOWN_MS, attemptsLeft: 0 };
  }
  await chrome.storage.local.set({ [ATTEMPTS_KEY]: attempts });
  return { ok: false, attemptsLeft: MAX_ATTEMPTS - attempts.count };
}

// ---------------------------------------------------------------------------
// Clear-on-lock (optional, requires the "browsingData" permission)
// ---------------------------------------------------------------------------

async function clearDataIfEnabled() {
  const settings = await getSettings();
  if (!settings.clearOnLock || !chrome.browsingData) return;

  const d = settings.clearData;
  const dataset = {
    history: Boolean(d.history),
    downloads: Boolean(d.downloads),
    cache: Boolean(d.cache),
    cookies: Boolean(d.cookies),
    formData: Boolean(d.formData)
  };
  if (!Object.values(dataset).some(Boolean)) return;

  try {
    await chrome.browsingData.remove({ since: 0 }, dataset);
  } catch (e) {
    // Never let a clearing failure prevent the lock itself.
  }
}

// ---------------------------------------------------------------------------
// Tab locking / unlocking
// ---------------------------------------------------------------------------

function isInjectableUrl(url) {
  return (
    url &&
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('devtools://') &&
    !url.startsWith('edge://') &&
    !url.startsWith('about:')
  );
}

async function lockAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !isInjectableUrl(tab.url)) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scripts/content.js']
      });
    } catch (e) {
      // Pages like the Web Store refuse injection; the navigation
      // listener still blocks them on the next load.
    }
  }
}

async function unlockAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (tab.url.startsWith(UNLOCK_URL)) {
      const key = 'redir_' + tab.id;
      const saved = await chrome.storage.session.get(key);
      if (saved[key]) {
        await chrome.storage.session.remove(key);
        chrome.tabs.update(tab.id, { url: saved[key] }).catch(() => {});
      } else {
        chrome.tabs.update(tab.id, { url: 'chrome://newtab/' }).catch(() => {});
      }
    } else if (isInjectableUrl(tab.url)) {
      chrome.tabs.reload(tab.id).catch(() => {});
    }
  }
}

async function lockProfile() {
  if (!(await hasPassword())) return { ok: false, error: 'no-password' };
  await chrome.storage.local.set({ [LOCKED_KEY]: true });
  await Promise.all([lockAllTabs(), clearDataIfEnabled()]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Idle auto-lock (optional, requires the "idle" permission)
// ---------------------------------------------------------------------------

async function applyIdleSettings() {
  if (!chrome.idle) return;
  const settings = await getSettings();
  if (settings.idleLock) {
    const seconds = Math.max(60, Math.round(settings.idleMinutes * 60));
    chrome.idle.setDetectionInterval(seconds);
  }
}

// Guarded synchronous registration: once the "idle" permission is granted,
// chrome.idle exists on every worker start and this listener wakes it.
if (chrome.idle) {
  chrome.idle.onStateChanged.addListener(async (state) => {
    if (state === 'active') return;
    const settings = await getSettings();
    if (!settings.idleLock) return;
    const lockState = await chrome.storage.local.get(LOCKED_KEY);
    if (lockState[LOCKED_KEY] === true) return;
    if (await hasPassword()) await lockProfile();
  });
  applyIdleSettings();
}

// ---------------------------------------------------------------------------
// Navigation interception (registered at the top level so it survives
// service-worker restarts — MV3 workers are shut down when idle)
// ---------------------------------------------------------------------------

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url || '';
  if (
    url.startsWith(chrome.runtime.getURL('')) ||
    url.startsWith('chrome://') ||
    url.startsWith('devtools://') ||
    url.startsWith('edge://')
  ) {
    return;
  }

  const state = await chrome.storage.local.get(LOCKED_KEY);
  if (state[LOCKED_KEY] !== true || !(await hasPassword())) return;

  // Remember where the user was heading so the tab can be restored after unlock.
  await chrome.storage.session.set({ ['redir_' + details.tabId]: url });
  chrome.tabs.update(details.tabId, { url: UNLOCK_URL }).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove('redir_' + tabId).catch(() => {});
});

// ---------------------------------------------------------------------------
// Lifecycle + What's New onboarding
// ---------------------------------------------------------------------------

function setUpdateBadge(on) {
  chrome.action.setBadgeText({ text: on ? '1' : '' }).catch(() => {});
  if (on) chrome.action.setBadgeBackgroundColor({ color: '#4a90d9' }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await migrateLegacyPassword();

  if (details.reason === 'install') {
    chrome.tabs.create({ url: SETUP_URL }).catch(() => {});
    return;
  }

  if (details.reason === 'update') {
    const prev = details.previousVersion || '0';
    // Show the What's New page once when upgrading from a version
    // that predates the optional privacy features (< 2.1.0).
    const [prevMajor, prevMinor] = prev.split('.').map((n) => parseInt(n, 10) || 0);
    if (prevMajor < 2 || (prevMajor === 2 && prevMinor < 1)) {
      await chrome.storage.local.set({ [WHATSNEW_KEY]: chrome.runtime.getManifest().version });
      setUpdateBadge(true);
      chrome.tabs.create({ url: WHATSNEW_URL, active: true }).catch(() => {});
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await migrateLegacyPassword();
  await applyIdleSettings();
  if (await hasPassword()) {
    await lockProfile();
  }
  const pending = await chrome.storage.local.get(WHATSNEW_KEY);
  setUpdateBadge(Boolean(pending[WHATSNEW_KEY]));
});

// ---------------------------------------------------------------------------
// Message API
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    // content.js expects a plain boolean
    checkLockStatus: async () => {
      const state = await chrome.storage.local.get(LOCKED_KEY);
      return state[LOCKED_KEY] === true && (await hasPassword());
    },

    getState: async () => {
      const state = await chrome.storage.local.get([LOCKED_KEY, WHATSNEW_KEY]);
      return {
        locked: state[LOCKED_KEY] === true,
        hasPassword: await hasPassword(),
        whatsnewPending: Boolean(state[WHATSNEW_KEY]),
        version: chrome.runtime.getManifest().version
      };
    },

    getHint: async () => {
      const data = await chrome.storage.local.get(HINT_KEY);
      return data[HINT_KEY] || '';
    },

    verifyPassword: async () => {
      const result = await verifyWithThrottle(request.password);
      if (result.ok) {
        await chrome.storage.local.set({ [LOCKED_KEY]: false });
        // Restore tabs slightly after responding, so the unlock screen can
        // show its success state before the page beneath it reloads.
        setTimeout(() => unlockAllTabs(), 400);
      }
      return result;
    },

    // Changing an existing password requires the current one.
    setPassword: async () => {
      if (await hasPassword()) {
        const check = await verifyWithThrottle(request.currentPassword);
        if (!check.ok) {
          return { ok: false, error: 'wrong-current', ...check };
        }
      }
      if (!request.password || request.password.length < 8) {
        return { ok: false, error: 'too-short' };
      }
      await storePassword(request.password, request.hint);
      return { ok: true };
    },

    lockNow: async () => lockProfile(),

    getSettings: async () => getSettings(),

    setSettings: async () => {
      const current = await getSettings();
      const next = {
        ...current,
        ...request.settings,
        clearData: { ...current.clearData, ...((request.settings || {}).clearData || {}) }
      };
      next.idleMinutes = Math.min(240, Math.max(1, parseInt(next.idleMinutes, 10) || 10));
      await chrome.storage.local.set({ [SETTINGS_KEY]: next });
      await applyIdleSettings();
      return { ok: true, settings: next };
    },

    whatsnewSeen: async () => {
      await chrome.storage.local.remove(WHATSNEW_KEY);
      setUpdateBadge(false);
      return { ok: true };
    }
  };

  if (handlers[request.action]) {
    handlers[request.action]()
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});
