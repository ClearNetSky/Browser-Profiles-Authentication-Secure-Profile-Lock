// Secure Profile Lock — content script.
// Runs at document_start on every page; when the profile is locked it stops
// the page from loading and replaces it with the unlock screen.

(async function () {
  // Only the top frame shows the lock screen; the overlay covers everything.
  if (window.top !== window) return;

  let locked = false;
  try {
    locked = await chrome.runtime.sendMessage({ action: 'checkLockStatus' });
  } catch (e) {
    // Extension context unavailable (e.g. it was just reloaded) — do nothing.
    return;
  }
  if (!locked) return;

  // Stop the original page from loading any further.
  try {
    window.stop();
  } catch (e) {
    /* ignore */
  }

  const unlockUrl = chrome.runtime.getURL('html/unlock.html');
  document.documentElement.innerHTML = `
    <head>
      <meta charset="UTF-8">
      <title>Profile Locked</title>
    </head>
    <body style="margin:0;background:#0d1420">
      <iframe src="${unlockUrl}"
              style="position:fixed;top:0;left:0;width:100vw;height:100vh;border:none;z-index:2147483647;background:#0d1420">
      </iframe>
    </body>
  `;

  // If anything removes the lock iframe, reload the page (which locks it again).
  const frame = document.querySelector('iframe');
  const observer = new MutationObserver(() => {
    if (!document.documentElement.contains(frame)) {
      observer.disconnect();
      location.reload();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
