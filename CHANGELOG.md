# Changelog

## v2.3.1 - 2026-04-24

### Summary

Adds a support-specific favicon for Amplience Support pages.

### Module Highlights

- Favicon & Title Updater: Support favicon applied on `support.amplience.com` pages.

---

## v2.3.0 - 2026-04-17

### Summary

Adds the Favicon & Title Updater module — a hardcoded, simplified version of the standalone [Favicon Swapper](https://github.com/mattisherwood/favicon-swapper) extension, now built directly into Amplience Helper.

### Module Highlights

- Favicon & Title Updater: New module. Swaps the browser tab favicon and prepends a context-aware title for each Amplience interface area (Dynamic Content, Content Hub, Workforce). Toggle via popup and options page.

---

## v2.2.3 - 2026-04-24

### Summary

Theming now supports per-hub configuration. Each hub keeps its own colour and dark-mode preference, and hub labels are shown in popup/options for easier management.

### Module Highlights

- Theming: Theme settings are now stored per hub, based on the hub segment in the DC URL.
- Theming: Popup and options now render one theme row per hub with label, colour control, dark toggle, and remove action.
- Theming: Friendly hub labels are auto-detected from the DC UI and used in controls, with the hub key available on hover.

### Migration Notes

- Existing single-theme values are replaced by the new per-hub theme structure. Visit each hub once to auto-create and manage its theme entry.

---

## v2.2.0 - 2026-04-16

### Summary

Adds the Theming module, bringing a customisable colour theme and optional dark mode to the Amplience DC interface.

### Module Highlights

- Theming: New module. Applies a user-defined accent colour to the DC interface via a CSS variable. Includes an optional dark mode. Both the colour and dark toggle are accessible directly from the popup and options page.

---

## v2.1.0 - 2026-04-01

### Summary

First public release on the Chrome Web Store. No new module features; this version marks the move to store-managed distribution, adds the required 128×128 icon asset for the store listing, and refreshes installation documentation to reflect both Store and manual install paths.

### Module Highlights

No module changes in this release.

### Migration Notes

- Users previously on a manual Load unpacked install can switch to the Chrome Web Store listing for automatic updates. Manual installation remains fully supported for contributors and developer use.

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
