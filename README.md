# 🔒 Secure Profile Lock - Chrome Extension

[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/aonieimkkkiknekpipfblglanjganbol?color=blue)](https://chrome.google.com/webstore/detail/browser-profiles-authenti/aonieimkkkiknekpipfblglanjganbol)
[![GitHub license](https://img.shields.io/badge/license-GPL%20v3-blue)](https://github.com/ClearNetSky/Browser-Profiles-Authentication-Secure-Profile-Lock/blob/main/LICENSE)
![Manifest Version](https://img.shields.io/badge/manifest-v3-important)

<div align="center">
  <img src="images/icon.png" alt="Secure Profile Lock Logo" width="128">
  <p><em>Password protection for browser profiles - Keep your browsing private and secure</em></p>
</div>

---

## 📖 Overview

**Secure Profile Lock** is a powerful Chrome extension that adds password protection to your browser profiles. Whether you share your computer with family members, work in a public space, or simply want to keep your browsing data secure, this extension provides robust profile-level authentication.

Every time your browser restarts or when someone tries to access your protected profile, they'll need to enter the correct password. All data is stored locally on your device - no servers, no cloud, no tracking.

## 🌟 Key Features

- 🔐 **Password-protected profiles** - Secure your Chrome profile with a custom password
- 🧂 **Hashed password storage** - Passwords are stored as salted PBKDF2-SHA256 hashes, never in plaintext
- 🔄 **Auto-lock on restart** - Profile automatically locks when browser closes
- ⚡ **Lock on demand** - Lock the profile instantly from the toolbar popup
- ✏️ **Change password anytime** - Update your password from the popup, no reinstall needed
- 🛑 **Brute-force protection** - 30-second cooldown after 5 wrong attempts
- 🔁 **Tab restore after unlock** - Tabs return to where you were heading before the lock screen
- 🌐 **Universal coverage** - Works on all websites and tabs (except Chrome internal pages)
- 🏠 **100% local storage** - Zero data collection, everything stays on your device
- 🛡️ **Tamper-proof design** - Prevents bypassing through extension disabling
- 💡 **Password hints** - Optional hints, revealed only on demand
- 🎨 **Modern dark interface** - Redesigned unlock, setup, and popup screens with password strength meter, show/hide password, and Caps Lock warning

## 🚀 Installation

### Option 1: Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store page](https://chrome.google.com/webstore/detail/browser-profiles-authenti/aonieimkkkiknekpipfblglanjganbol)
2. Click **"Add to Chrome"**
3. Click **"Add extension"** in the confirmation dialog
4. Set up your password when prompted

### Option 2: Manual Installation (For Development)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ClearNetSky/Browser-Profiles-Authentication-Secure-Profile-Lock.git
   cd Browser-Profiles-Authentication-Secure-Profile-Lock
   ```

2. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top-right corner)
   - Click **"Load unpacked"**
   - Select the cloned repository folder

3. **Set up your password:**
   - The extension will automatically open the password setup page
   - Create a strong password (minimum 8 characters)
   - Optionally add a password hint

## 📱 How to Use

### First-Time Setup

1. After installation, the extension automatically opens the **Password Setup** page
2. Enter your desired password (minimum 8 characters) - the strength meter helps you pick a good one
3. Confirm your password
4. (Optional) Add a password hint to help you remember
5. Click **"Save Password"**
6. Your profile is now protected! Use **"Lock now to test it"** to try the lock screen immediately

### Daily Use

- **Locking:** Your profile locks automatically when you close and reopen Chrome, or instantly via the toolbar popup → **"Lock Profile Now"**
- **Unlocking:** Enter your password when the unlock screen appears
- **Normal browsing:** Once unlocked, browse normally until the profile locks again

### Password Management

To change your password:
1. Click the extension icon in the toolbar
2. Click **"Change Password…"**
3. Enter your current password, then your new one

> ⚠️ **Important:** There is no password recovery mechanism. If you forget your password, you'll need to remove and reinstall the extension, which will require setting up a new password.

## 🛠️ How It Works

The extension uses Chrome's Manifest V3 architecture with the following components:

### Technical Architecture

```
┌─────────────────────────────────────────┐
│   Background Service Worker             │
│   (base_script/background.js)           │
│   - PBKDF2 password hashing/verifying   │
│   - Lock/unlock state control           │
│   - Brute-force cooldown                │
│   - Tab navigation interception         │
└─────────────┬───────────────────────────┘
              │
              ├──► Local Storage (chrome.storage.local)
              │    └─ Password hash + salt (PBKDF2-SHA256)
              │    └─ Lock state
              │    └─ Password hint
              │
              ├──► Content Scripts (scripts/content.js)
              │    └─ Injected into all tabs
              │    └─ Enforces lock screen
              │
              └──► UI Pages
                   ├─ password-setup.html (Setup / change password)
                   ├─ unlock.html (Unlock screen)
                   └─ popup.html (Toolbar popup)
```

### Security Model

- **Password Storage:** Passwords are never stored in plaintext. They are hashed with PBKDF2-SHA256 (310,000 iterations) using a random 16-byte salt, via the Web Crypto API. Users upgrading from version 1.x are migrated automatically - the old plaintext password is hashed and removed on the first run of the new version.
- **Brute-force Throttling:** After 5 failed attempts, unlocking is blocked for 30 seconds.
- **Lock Enforcement:** Content scripts stop page loading and replace the page with the lock screen until authentication succeeds.
- **Navigation Control:** The web navigation API intercepts all page loads while locked and remembers the original URL so the tab can be restored after unlock.
- **Tamper Protection:** Removing the lock screen from the page triggers an immediate reload, which locks it again.

## 🔒 Security Considerations

### Current Security Features
- ✅ Salted PBKDF2-SHA256 password hashing (no plaintext at rest)
- ✅ Local-only storage (no network transmission)
- ✅ Brute-force cooldown
- ✅ Profile-level protection
- ✅ Auto-lock on browser restart + manual lock on demand
- ✅ Universal website coverage

### Security Limitations
- ⚠️ No password recovery mechanism (by design for security)
- ⚠️ Cannot protect Chrome internal pages (chrome://)
- ⚠️ Users with access to the file system could remove the extension's storage to reset the lock (but cannot recover the password itself)
- ⚠️ Provides protection against casual access but not against determined technical users

### Recommendations for Enhanced Security
- Use a strong, unique password (12+ characters with mixed case, numbers, symbols)
- Don't share your password
- Consider using a password manager to store your profile password
- For maximum security, also use your OS-level account password protection

## 🗂️ Project Structure

```
Browser-Profiles-Authentication-Secure-Profile-Lock/
├── base_script/
│   └── background.js         # Service worker - core logic, hashing, throttling
├── html/
│   ├── password-setup.html   # Password setup / change page
│   ├── unlock.html           # Profile unlock page
│   └── popup.html            # Toolbar popup
├── images/
│   └── icon.png              # Extension icon
├── scripts/
│   ├── content.js            # Content script injected into pages
│   ├── password-setup.js     # Setup / change password logic
│   ├── unlock.js             # Unlock screen logic
│   └── popup.js              # Toolbar popup logic
├── styles/
│   └── styles.css            # Shared design system (dark theme)
├── manifest.json             # Extension manifest (Manifest V3)
├── LICENSE                   # GNU GPL v3 License
└── README.md                 # This file
```

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/AmazingFeature`
3. **Make your changes** and test thoroughly
4. **Commit your changes:** `git commit -m 'Add some AmazingFeature'`
5. **Push to the branch:** `git push origin feature/AmazingFeature`
6. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and structure
- Test all changes in Chrome before submitting
- Update documentation for new features
- Ensure no breaking changes to existing functionality

## ❓ FAQ & Troubleshooting

### Q: I forgot my password. How can I recover it?
**A:** There is no password recovery mechanism by design (for security). You'll need to remove and reinstall the extension, which will allow you to set a new password.

### Q: Can I use this on multiple profiles?
**A:** Yes! Each Chrome profile can have its own separate password. Install the extension on each profile you want to protect.

### Q: Does this work on Firefox or other browsers?
**A:** Currently, this is designed specifically for Chrome and Chromium-based browsers. Firefox support would require adaptation to Firefox's extension API.

### Q: The extension isn't locking my profile. What's wrong?
**A:** Make sure:
- The extension is enabled (`chrome://extensions/`)
- You've completed the initial password setup
- You've fully closed and reopened Chrome (not just closing windows)

### Q: Can I disable the extension temporarily?
**A:** For security reasons, the extension is designed to resist tampering. To remove protection, you need to uninstall it completely.

### Q: Is my password encrypted?
**A:** Yes. Since version 2.0 your password is stored as a salted PBKDF2-SHA256 hash - it is never written to disk in plaintext, and the hash cannot be reversed into the original password. Existing users are migrated automatically on update.

### Q: I updated from version 1.x. Do I need to do anything?
**A:** No. Your existing password keeps working - it is automatically converted to a secure hash on the first run of version 2.0, and the plaintext copy is removed.

## 📄 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Aristarh Ucolov**
- GitHub: [@AristarhUcolov](https://github.com/AristarhUcolov/)
- Email: aristarh.ucolov@gmail.com

## 🙏 Acknowledgments

- Inspired by the need for simple, effective profile protection
- Built with Chrome Extension Manifest V3
- Thanks to the Chrome Extensions community

---

<div align="center">
  <p>If you find this extension useful, please consider giving it a ⭐ on GitHub!</p>
  <p>Made with ❤️ by <a href="https://github.com/AristarhUcolov/">Aristarh Ucolov</a></p>
</div>
