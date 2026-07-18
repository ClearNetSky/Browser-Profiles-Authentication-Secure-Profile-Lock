// Secure Profile Lock — toolbar popup logic.

document.addEventListener('DOMContentLoaded', async () => {
  await i18nReady;

  const statusPill = document.getElementById('status');
  const lockBtn = document.getElementById('lockBtn');
  const setupBtn = document.getElementById('setupBtn');
  const changeBtn = document.getElementById('changeBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const whatsnewBanner = document.getElementById('whatsnewBanner');
  const versionSpan = document.getElementById('version');

  const setupUrl = chrome.runtime.getURL('html/password-setup.html');
  const whatsnewUrl = chrome.runtime.getURL('html/whatsnew.html');

  let state = { locked: false, hasPassword: false, whatsnewPending: false, version: '' };
  try {
    state = await chrome.runtime.sendMessage({ action: 'getState' });
  } catch (e) {
    statusPill.textContent = t('status_unavailable');
    statusPill.className = 'status-pill status-none';
    return;
  }

  versionSpan.textContent = 'v' + (state.version || '');

  if (state.whatsnewPending) {
    whatsnewBanner.classList.remove('hidden');
    whatsnewBanner.addEventListener('click', () => {
      chrome.tabs.create({ url: whatsnewUrl });
      window.close();
    });
  }

  if (!state.hasPassword) {
    statusPill.textContent = t('status_no_password');
    statusPill.className = 'status-pill status-none';
    setupBtn.classList.remove('hidden');
  } else if (state.locked) {
    statusPill.textContent = t('status_locked');
    statusPill.className = 'status-pill status-locked';
  } else {
    statusPill.textContent = t('status_protected');
    statusPill.className = 'status-pill status-unlocked';
    lockBtn.classList.remove('hidden');
    changeBtn.classList.remove('hidden');
    settingsBtn.classList.remove('hidden');
  }

  lockBtn.addEventListener('click', async () => {
    lockBtn.disabled = true;
    lockBtn.textContent = t('btn_locking');
    try {
      await chrome.runtime.sendMessage({ action: 'lockNow' });
    } finally {
      window.close();
    }
  });

  const openSetup = () => {
    chrome.tabs.create({ url: setupUrl });
    window.close();
  };
  setupBtn.addEventListener('click', openSetup);
  changeBtn.addEventListener('click', openSetup);

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
});
