// Secure Profile Lock — toolbar popup logic.

document.addEventListener('DOMContentLoaded', async () => {
  const statusPill = document.getElementById('status');
  const lockBtn = document.getElementById('lockBtn');
  const setupBtn = document.getElementById('setupBtn');
  const changeBtn = document.getElementById('changeBtn');
  const versionSpan = document.getElementById('version');

  const setupUrl = chrome.runtime.getURL('html/password-setup.html');

  let state = { locked: false, hasPassword: false, version: '' };
  try {
    state = await chrome.runtime.sendMessage({ action: 'getState' });
  } catch (e) {
    statusPill.textContent = 'Extension unavailable';
    statusPill.className = 'status-pill status-none';
    return;
  }

  versionSpan.textContent = 'v' + (state.version || '');

  if (!state.hasPassword) {
    statusPill.textContent = 'No password set';
    statusPill.className = 'status-pill status-none';
    setupBtn.classList.remove('hidden');
  } else if (state.locked) {
    statusPill.textContent = 'Profile is locked';
    statusPill.className = 'status-pill status-locked';
  } else {
    statusPill.textContent = 'Protected · Unlocked';
    statusPill.className = 'status-pill status-unlocked';
    lockBtn.classList.remove('hidden');
    changeBtn.classList.remove('hidden');
  }

  lockBtn.addEventListener('click', async () => {
    lockBtn.disabled = true;
    lockBtn.textContent = 'Locking…';
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
});
