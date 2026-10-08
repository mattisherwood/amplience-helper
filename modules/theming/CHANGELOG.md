# Theming Changelog

## 2026-10-08 (extension v2.5.1)

### Added

- Nextgen UI support. `theming.js` and the new `theming.nextgen.css` load on `https://nextgen.amplience.net/*`. `getHubNameFromUrl()` reads the hub from the path there (`/:orgName/:area/:hubName`, where area is `content`, `media`, `flows` or `reviews`), and returns null on org-level pages so the default blue applies.
- `theming.nextgen.css` derives the full `--mantine-color-primary-0`…`9` scale from `--theme-color-rgb` via `color-mix()` (the white/black percentages reproduce Mantine's default scale exactly), along with the `-light` / `-outline-hover` rgba tokens, the `--mantine-primary-color-filled` alias fixes, and the selected-repository label colour.
- Dark mode on nextgen: a dark hub sets Mantine's `data-mantine-color-scheme="dark"` on `<html>` instead of the legacy `.dark` class. Light hubs, and theming being off, hand the attribute back to whatever Mantine last set (tracked by an attribute observer, which also re-asserts dark if Mantine writes later).

### Changed

- `chrome.storage.onChanged` now re-runs `applyCurrentHubTheme()` for both `themingHubs` and `themingEnabled` changes, so toggling theming off also resets the nextgen colour scheme.

### Notes

- Only the attribute is changed, not Mantine's stored preference, so anything reading `useMantineColorScheme()` in JS still sees the user's own scheme.
- `hub-switcher-row-colors.js` isn't loaded on nextgen, because it targets the legacy hub selector.

---

## 2026-05-09 (extension v2.3.10)

### Fixed

- Updated the dots in the hub switcher menu to accurately show their hub's colour even when they don't have one specified (Previously defaulted to current hub's theme)

### Added

- The hub switcher menu now shows dark dots for dark-theme hubs

---

## 2026-05-09 (extension v2.3.8)

### Changed

- Updated themed styling for secondary app links in the switcher menu to improve contrast and hover clarity.

---

## 2026-04-27 (extension v2.2.4)

### Fixed

- Prevented the temporary `login-prompt` route from creating a stored hub theme.

### Added

- Added dots to the Hub-switcher menu, each showing its own saved theme colour.
- (Extracted the hub-switcher row colour logic into a dedicated theming script to keep the main theming runtime simpler.)

---

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

---

## 2026-04-22 (extension v2.2.1)

### Fixed

- Styles applied across further pages: editing pages, scheduling etc.

### Changed

- Updated default colour to match existing default
- Cleaning up of colour variables

---

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
