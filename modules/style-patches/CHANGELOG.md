# Style Patches Changelog

## 2026-05-14 (extension v2.3.9)

### Fixed

- Fixed z-index issue in Workforce/Dynamic Content app header to prevent overlap with other UI elements.
- Fixed an issue with Monaco Editor in the core Workforce Flows UI.

### Notes

- The z-index fix is implemented in the new `style-patches.wf.css` file, scoped to the `data-amplience-style-patches="enabled"` attribute.
- The Monaco Editor fix is implemented in the `style-patches.js` file.

---

## 2026-05-09 (extension v2.3.8)

### Added

- Added DAM-specific switcher menu patches (`style-patches.dam.css`) for consistent sizing, spacing, icon alignment, and hover behaviour.
- Added a Workforce link insertion in the switcher app list while Style Patches is enabled.

### Changed

- Expanded DC switcher and masthead responsiveness, including improved menu sizing and wrap behaviour at narrower widths.
- Refined top-level homepage app-card layout spacing and typography flow for better readability.

### Notes

- The inserted Workforce link is removed when Style Patches is disabled.

---

## 2026-05-07 (extension v2.3.5)

### Changed

- Separated style patches for different areas into separate files
- Improved patch coverage
- Specified minimum-width which each file helps support down to

---

## 2026-04-24 (extension v2.2.2)

- Made top-level homepage more responsive

---

## 2026-04-16 (extension v2.2)

- Fixed content folder tree including icons
- Made dashboards more responsive

---

## 2026-03-25 (extension v2.0)

### Changed

- No functional changes. Extension restructured and renamed; module migrated to unified toggle system.

---

## 2026-02-24 (extension v1.2)

### Added

- `stylesEnabled` setting in `chrome.storage.sync`.
- UI toggle in extension options page to enable/disable style patches.

---

## 2026-01-23 (extension v1.1)

### Changed

- Cleaner top-nav item interactions.

---

## 2026-01-23 (extension v1.0)

### Added

- Initial release.
- Responsive header: better wrapping and sizing for the main navigation bar.
- Flexible layout: removed minimum width constraints for better viewport compatibility.
- Enhanced table readability: improved column widths in content view lists.
