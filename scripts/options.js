// Secure Profile Lock — settings page logic.
// Optional permissions (browsingData, idle) are requested only when the
// user turns the corresponding feature on.

document.addEventListener('DOMContentLoaded', async () => {
  await i18nReady;

  // The settings page must not be usable while the profile is locked.
  try {
    const state = await chrome.runtime.sendMessage({ action: 'getState' });
    if (state && state.locked && state.hasPassword) {
      window.location.replace(chrome.runtime.getURL('html/unlock.html'));
      return;
    }
  } catch (e) {
    /* proceed — worst case the toggles simply fail */
  }

  const clearOnLock = document.getElementById('clearOnLock');
  const dataBoxes = {
    history: document.getElementById('dataHistory'),
    downloads: document.getElementById('dataDownloads'),
    cache: document.getElementById('dataCache'),
    cookies: document.getElementById('dataCookies'),
    formData: document.getElementById('dataFormData')
  };
  const clearDataOptions = document.getElementById('clearDataOptions');
  const idleLock = document.getElementById('idleLock');
  const idleMinutes = document.getElementById('idleMinutes');
  const idleOptions = document.getElementById('idleOptions');
  const messageDiv = document.getElementById('message');
  const toast = document.getElementById('toast');

  let toastTimer = null;

  // --- Load current settings ----------------------------------------------
  const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
  clearOnLock.checked = Boolean(settings.clearOnLock);
  for (const [key, box] of Object.entries(dataBoxes)) {
    box.checked = Boolean(settings.clearData[key]);
  }
  idleLock.checked = Boolean(settings.idleLock);
  idleMinutes.value = String(settings.idleMinutes);
  if (![...idleMinutes.options].some((o) => o.value === idleMinutes.value)) {
    idleMinutes.value = '10';
  }
  updateSubOptions();

  // --- Persist ------------------------------------------------------------
  async function save() {
    const payload = {
      clearOnLock: clearOnLock.checked,
      clearData: {
        history: dataBoxes.history.checked,
        downloads: dataBoxes.downloads.checked,
        cache: dataBoxes.cache.checked,
        cookies: dataBoxes.cookies.checked,
        formData: dataBoxes.formData.checked
      },
      idleLock: idleLock.checked,
      idleMinutes: parseInt(idleMinutes.value, 10)
    };
    await chrome.runtime.sendMessage({ action: 'setSettings', settings: payload });
    showToast();
  }

  function updateSubOptions() {
    clearDataOptions.classList.toggle('disabled', !clearOnLock.checked);
    clearDataOptions.querySelectorAll('input').forEach((el) => (el.disabled = !clearOnLock.checked));
    idleOptions.classList.toggle('disabled', !idleLock.checked);
    idleMinutes.disabled = !idleLock.checked;
  }

  // --- Toggles that need optional permissions ------------------------------
  clearOnLock.addEventListener('change', async () => {
    hideMessage();
    if (clearOnLock.checked) {
      const granted = await chrome.permissions
        .request({ permissions: ['browsingData'] })
        .catch(() => false);
      if (!granted) {
        clearOnLock.checked = false;
        showMessage(t('permission_denied'), 'warning');
      }
    }
    updateSubOptions();
    save();
  });

  idleLock.addEventListener('change', async () => {
    hideMessage();
    if (idleLock.checked) {
      const granted = await chrome.permissions
        .request({ permissions: ['idle'] })
        .catch(() => false);
      if (!granted) {
        idleLock.checked = false;
        showMessage(t('permission_denied'), 'warning');
      }
    }
    updateSubOptions();
    save();
  });

  Object.values(dataBoxes).forEach((box) => box.addEventListener('change', save));
  idleMinutes.addEventListener('change', save);

  // --- UI helpers ----------------------------------------------------------
  function showToast() {
    toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
  }

  function hideMessage() {
    messageDiv.className = 'message hidden';
  }
});
