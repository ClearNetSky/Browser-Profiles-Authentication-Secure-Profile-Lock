// Secure Profile Lock — password setup / change screen logic.

document.addEventListener('DOMContentLoaded', async () => {
  await i18nReady;

  const card = document.getElementById('card');
  const form = document.getElementById('passwordForm');
  const currentField = document.getElementById('currentField');
  const currentInput = document.getElementById('currentPassword');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPassword');
  const hintInput = document.getElementById('hint');
  const submitBtn = document.getElementById('submitBtn');
  const messageDiv = document.getElementById('message');
  const strength = document.getElementById('strength');
  const strengthLabel = document.getElementById('strengthLabel');
  const successState = document.getElementById('successState');
  const lockNowBtn = document.getElementById('lockNowBtn');

  let changeMode = false;

  // --- Detect change-password mode -----------------------------------------
  try {
    const state = await chrome.runtime.sendMessage({ action: 'getState' });
    if (state && state.hasPassword) {
      changeMode = true;
      currentField.classList.remove('hidden');
      currentInput.required = true;
      document.getElementById('pageTitle').textContent = t('change_title');
      document.getElementById('pageSubtitle').textContent = t('change_subtitle');
      submitBtn.textContent = t('btn_update');
      document.title = `${t('change_title')} — ${t('appName')}`;
    }
  } catch (e) {
    // Fall back to first-time setup mode.
  }

  // --- Show/hide password toggles ------------------------------------------
  const bindEye = (buttonId, input) => {
    const btn = document.getElementById(buttonId);
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? t('aria_hide_password') : t('aria_show_password'));
      input.focus();
    });
  };
  bindEye('eyeCurrent', currentInput);
  bindEye('eyeNew', passwordInput);
  bindEye('eyeConfirm', confirmInput);

  // --- Strength meter ------------------------------------------------------
  const scorePassword = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };
  const strengthNames = () => [
    '',
    t('strength_weak'),
    t('strength_fair'),
    t('strength_good'),
    t('strength_strong')
  ];

  passwordInput.addEventListener('input', () => {
    const score = scorePassword(passwordInput.value);
    strength.dataset.score = String(score);
    strengthLabel.textContent = strengthNames()[score];
  });

  // --- Submit --------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const password = passwordInput.value;

    if (changeMode && !currentInput.value) {
      showMessage(t('err_enter_current'), 'error');
      shake();
      return;
    }
    if (password.length < 8) {
      showMessage(t('err_too_short'), 'error');
      shake();
      return;
    }
    if (password !== confirmInput.value) {
      showMessage(t('err_mismatch'), 'error');
      shake();
      return;
    }
    if (hintInput.value.trim() === password) {
      showMessage(t('err_hint_equals'), 'error');
      shake();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = t('btn_saving');

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'setPassword',
        password: password,
        hint: hintInput.value.trim(),
        currentPassword: currentInput.value
      });

      if (result && result.ok) {
        showSuccess();
      } else if (result && result.error === 'wrong-current') {
        if (result.cooldownMs) {
          showMessage(t('cooldown', Math.ceil(result.cooldownMs / 1000)), 'warning');
        } else {
          showMessage(t('err_wrong_current'), 'error');
        }
        shake();
        resetSubmit();
        currentInput.value = '';
        currentInput.focus();
      } else {
        showMessage(t('err_save_failed'), 'error');
        resetSubmit();
      }
    } catch (error) {
      showMessage(t('err_unreachable'), 'error');
      resetSubmit();
    }
  });

  // --- Success state -------------------------------------------------------
  function showSuccess() {
    form.classList.add('hidden');
    messageDiv.className = 'message hidden';
    document.getElementById('pageTitle').classList.add('hidden');
    document.getElementById('pageSubtitle').classList.add('hidden');
    card.querySelector('.lock-badge').classList.add('hidden');

    if (changeMode) {
      document.getElementById('successTitle').textContent = t('success_change_title');
      document.getElementById('successText').textContent = t('success_change_text');
    }
    successState.classList.remove('hidden');
  }

  lockNowBtn.addEventListener('click', async () => {
    lockNowBtn.disabled = true;
    try {
      await chrome.runtime.sendMessage({ action: 'lockNow' });
      window.location.href = chrome.runtime.getURL('html/unlock.html');
    } catch (e) {
      lockNowBtn.disabled = false;
    }
  });

  function resetSubmit() {
    submitBtn.disabled = false;
    submitBtn.textContent = changeMode ? t('btn_update') : t('btn_save');
  }

  function shake() {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
  }
});
