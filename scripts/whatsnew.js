// Secure Profile Lock — What's New page logic.

document.addEventListener('DOMContentLoaded', () => {
  // Viewing the page marks the announcement as seen and clears the badge.
  chrome.runtime.sendMessage({ action: 'whatsnewSeen' }).catch(() => {});

  document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  document.getElementById('dismiss').addEventListener('click', () => {
    window.close();
  });
});
