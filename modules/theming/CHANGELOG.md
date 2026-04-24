# Theming Changelog

## 2026-04-24 (extension v2.2.3)

### Added

- Per-hub theme storage keyed by hub name, including `label`, `color`, and `isDark` values for each hub.
- Automatic creation of a default theme entry when visiting a hub that does not already have one.
- Friendly hub label detection from the DC hub selector, cached alongside each hub theme.
- Multi-row theme controls in popup and options with one row per hub and a remove button.

### Changed

- The theming runtime now applies theme values based on the current URL hub and reapplies on in-app URL changes.
- Theming controls moved from single global values to per-hub controls in both popup and options.

### Fixed

- Correct theme context is now maintained when switching between hubs in the same browser session.

### Notes

- Legacy single-theme keys (`themingColor`, `themingDark`) are no longer used.

## 2026-04-22 (extension v2.2.1)

### Fixed

- Styles applied across further pages: editing pages, scheduling etc.

### Changed

- Updated default colour to match existing default
- Cleaning up of colour variables

## 2026-04-16 (extension v2.2)

### Added

- New module for "theming".
- `themingEnabled` setting in `chrome.storage.sync` with a toggle in extension popup and options page to enable/disable theming.
- General styles updated to inherit colours appropriately.
- Background and Foreground colours set.
- Hint of a theme colour overlaid.
- Simple text input control added to the popup and options page to change the theme colour variable.
- Minimal dark rules within a `.dark` body class.
- Checkbox input control added to the popup and options page to toggle the dark version.
