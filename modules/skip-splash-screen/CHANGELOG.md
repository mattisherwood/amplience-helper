# Skip Splash Screen Changelog

## 2026-05-21 (extension v2.4.2)

### Added

- New optional Skip Splash Screen module.
- Automatically clicks the `.login-button` element on the Amplience login route when enabled.
- New `skipSplashScreenEnabled` toggle stored in `chrome.storage.sync`, wired into both popup and options.

### Notes

- Module defaults to off.
- Behaviour is limited to `https://app.amplience.net/#/login`.
- If Amplience changes the splash screen button selector, the module will fail silently until the selector is updated.
