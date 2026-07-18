// Secure Profile Lock — password setup / change screen logic.

document.addEventListener('DOMContentLoaded', async () => {
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
      document.getElementById('pageTitle').textContent = 'Change Password';
      document.getElementById('pageSubtitle').textContent =
        'Enter your current password, then choose a new one.';
      submitBtn.textContent = 'Update Password';
      document.title = 'Change Password — Secure Profile Lock';
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
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
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
  const strengthNames = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  passwordInput.addEventListener('input', () => {
    const score = scorePassword(passwordInput.value);
    strength.dataset.score = String(score);
    strengthLabel.textContent = strengthNames[score];
  });

  // --- Submit --------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const password = passwordInput.value;

    if (changeMode && !currentInput.value) {
      showMessage('Please enter your current password.', 'error');
      shake();
      return;
    }
    if (password.length < 8) {
      showMessage('The password must be at least 8 characters long.', 'error');
      shake();
      return;
    }
    if (password !== confirmInput.value) {
      showMessage('The passwords do not match.', 'error');
      shake();
      return;
    }
    if (hintInput.value.trim() === password) {
      showMessage('The hint must not be the password itself.', 'error');
      shake();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

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
          showMessage(
            `Too many attempts. Try again in ${Math.ceil(result.cooldownMs / 1000)}s.`,
            'warning'
          );
        } else {
          showMessage('The current password is incorrect.', 'error');
        }
        shake();
        resetSubmit();
        currentInput.value = '';
        currentInput.focus();
      } else {
        showMessage('Could not save the password. Please try again.', 'error');
        resetSubmit();
      }
    } catch (error) {
      showMessage('Could not reach the extension. Please try again.', 'error');
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
      document.getElementById('successTitle').textContent = 'Password Updated';
      document.getElementById('successText').textContent =
        'Your new password takes effect the next time the profile locks.';
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
    submitBtn.textContent = changeMode ? 'Update Password' : 'Save Password';
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
