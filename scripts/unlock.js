// Secure Profile Lock — unlock screen logic.

document.addEventListener('DOMContentLoaded', async () => {
  await i18nReady;

  const card = document.getElementById('card');
  const form = document.getElementById('unlockForm');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');
  const messageDiv = document.getElementById('message');
  const hintToggle = document.getElementById('hintToggle');
  const hintDiv = document.getElementById('hint');
  const capsWarning = document.getElementById('capsWarning');
  const toggleEye = document.getElementById('toggleEye');

  let cooldownTimer = null;

  passwordInput.focus();

  // --- Password hint (revealed on demand) ----------------------------------
  try {
    const hint = await chrome.runtime.sendMessage({ action: 'getHint' });
    if (hint) {
      hintToggle.classList.remove('hidden');
      hintDiv.textContent = hint;
      hintToggle.addEventListener('click', () => {
        const show = hintDiv.classList.contains('hidden');
        hintDiv.classList.toggle('hidden', !show);
        hintToggle.textContent = show ? t('hide_hint') : t('show_hint');
      });
    }
  } catch (e) {
    // Hint is optional — ignore failures.
  }

  // --- Show/hide password --------------------------------------------------
  toggleEye.addEventListener('click', () => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    toggleEye.setAttribute('aria-label', show ? t('aria_hide_password') : t('aria_show_password'));
    passwordInput.focus();
  });

  // --- Caps Lock indicator -------------------------------------------------
  const updateCaps = (e) => {
    if (typeof e.getModifierState === 'function') {
      capsWarning.classList.toggle('hidden', !e.getModifierState('CapsLock'));
    }
  };
  passwordInput.addEventListener('keydown', updateCaps);
  passwordInput.addEventListener('keyup', updateCaps);

  // --- Submit --------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    if (!passwordInput.value) {
      showMessage(t('err_enter_password'), 'error');
      shake();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = t('btn_unlocking');

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'verifyPassword',
        password: passwordInput.value
      });

      if (result && result.ok) {
        onUnlocked();
      } else if (result && result.cooldownMs) {
        startCooldown(result.cooldownMs);
      } else {
        const left = result && result.attemptsLeft;
        showMessage(left ? t('err_wrong_attempts', left) : t('err_wrong_password'), 'error');
        shake();
        resetSubmit();
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (error) {
      showMessage(t('err_unreachable'), 'error');
      resetSubmit();
    }
  });

  function onUnlocked() {
    card.classList.add('unlocked');
    form.querySelectorAll('input, button').forEach((el) => (el.disabled = true));
    hintToggle.classList.add('hidden');
    hintDiv.classList.add('hidden');
    showMessage(t('msg_unlocked'), 'success');
    // The background script reloads/restores every tab a moment later.
  }

  function startCooldown(ms) {
    passwordInput.value = '';
    passwordInput.disabled = true;
    submitBtn.disabled = true;
    shake();

    let remaining = Math.ceil(ms / 1000);
    const tick = () => {
      if (remaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        passwordInput.disabled = false;
        resetSubmit();
        hideMessage();
        passwordInput.focus();
        return;
      }
      showMessage(t('cooldown', remaining), 'warning');
      submitBtn.textContent = t('wait_seconds', remaining);
      remaining -= 1;
    };
    tick();
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(tick, 1000);
  }

  function resetSubmit() {
    submitBtn.disabled = false;
    submitBtn.textContent = t('btn_unlock');
  }

  function shake() {
    card.classList.remove('shake');
    // Force a reflow so the animation can replay.
    void card.offsetWidth;
    card.classList.add('shake');
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
  }

  function hideMessage() {
    messageDiv.className = 'message hidden';
  }
});
