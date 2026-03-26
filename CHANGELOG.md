# Changelog

## v2.1.0 - 2026-03-26

### Summary

Added automatic update checking system that monitors GitHub for new versions. Users now receive notifications when updates are available and can install them directly from the popup without manual downloads.

### Module Highlights

- Extension: Automatic version checking from GitHub with daily update checks and startup verification.
- Extension: Toolbar badge notification (red "!") appears when an update is available.
- Extension: "Update Available" menu item in popup allows one-click download and installation.

### Migration Notes

- Users do not need to take any action; update system activates automatically on extension load.
- Extension will prompt to reload after downloading an update; this is normal and required to apply changes.

---

## v2.0 - 2026-03-25

### Summary

Major restructuring of the extension. Hotkeys merged in from a standalone extension, background service worker removed, context menu removed, and modules reorganised under a unified toggle system. Extension renamed to reflect its broader scope.

### Module Highlights

- Extension: Renamed; background service worker and context menu removed.
- Extension: `contextMenus` permission removed — toggles managed exclusively via popup and options page.
- Hotkeys: Integrated from standalone `amplience-hotkeys` extension; now toggle-controlled via `chrome.storage.sync`.
- Flows Filter: Renamed from `content-flows-filter` internally.

---

## v1.5.1 - 2026-03-13

### Summary

Flows filter gains awareness of the current user, surfacing their flows and enabling a personal filter mode.

### Module Highlights

- Flows Filter: Detects the current user's initials and highlights their flows; adds a "My flows" toggle.

### Notes

- "My flows" matches initials from the flow title naming convention only — a usability convenience, not full RBAC identity.

---

## v1.5 - 2026-03-11

### Summary

Flows filter now parses structured metadata out of flow titles.

### Module Highlights

- Flows Filter: Extracts author and tag data from flow titles based on naming convention.

---

## v1.4 - 2026-02-24

### Summary

Introduced the Flows Filter module with real-time filtering, debouncing, and a toggle in popup, options, and context menu.

### Module Highlights

- Flows Filter: Filter input with clear button, 100ms debouncing, data-visibility-based show/hide, mutation observer for dynamically loaded panels.
- Extension: Added `flowFilter` setting; content script extended to cover `content-studio/content-flows` URLs.

---

## v1.3 - 2026-02-24

### Summary

Added quick-access toggles for enabling/disabling patches without opening options.

### Module Highlights

- Extension: Popup checkbox on extension icon; right-click context menu checkbox; state synced via `chrome.storage.sync`.

---

## v1.2 - 2026-02-24

### Summary

Added a full extension options page with the first user-facing module toggle.

### Module Highlights

- Style Patches: `stylesEnabled` setting added to storage; UI toggle in the options page.
- Extension: Options page introduced.

---

## v1.1 - 2026-01-23

### Summary

Minor style polish for top-nav interactions.

### Module Highlights

- Style Patches: Cleaner top-nav item interactions.

---

## v1.0 - 2026-01-23

### Summary

Initial release. Responsive and readability CSS improvements applied to Amplience pages.

### Module Highlights

- Style Patches: Responsive header, flexible layout (removed min-width constraints), improved table column widths.
