# Enhanced Naming Changelog

## 2026-10-07 (extension v2.5.1)

### Changed

- Reworked for the core-product app rename (Dynamic Content → CMS, Content Hub → DAM). The native app cards and switchers now have a short title plus a subtitle, so the module rewrites only the **subtitle** rather than the title, description and button text.
- Homepage: `.primary-app__subtitle` now reads "Content Management System" (first card) and "Digital Asset Management" (second card). The title, description and "Manage" button overrides are gone, as the native copy now does that job.
- CMS app switcher (FKA Dynamic Content): the current-app title (`.am-switcheroo__title`) now reads "CMS" (was "Content Management"), and the DAM link's subtitle (`#content-hub-link .am-switcheroo__primary-subtitle`) reads "Digital Asset Management".
- DAM app switcher (FKA Content Hub): the current-app title now reads "DAM" (was "Digital Asset Management"), and the CMS link's subtitle (`.switcheroo__primary-app-subtitle`) reads "Content Management System".
- Account management switcher: `/content` and `/media` links now target `.switcheroo-item__subtitle` instead of the bare `.switcheroo-item__parent-wrapper > span`.
- Replacement subtitle text drops from 16px to 12px to sit alongside the native subtitle styling.

### Removed

- The dashed "AI & Automation" frame around `.apps__studios_body` on the homepage.

### Notes

- Every override is now hung off a subtitle element. If Amplience drops or renames those elements, the rules simply stop matching and the native labels show through.

---

## 2026-05-09 (extension v2.3.8)

### Added

- New module for enhanced app naming labels across key Amplience surfaces.
- New `enhancedNamingEnabled` toggle stored in `chrome.storage.sync`, wired into popup and options.
- Attribute-scoped styling via `data-amplience-enhanced-naming="enabled"` for instant enable/disable behaviour.

### Changed

- Replaces selected app labels and helper text with clearer naming on the top-level homepage and switcher menus.

### Notes

- Module defaults to enabled.
