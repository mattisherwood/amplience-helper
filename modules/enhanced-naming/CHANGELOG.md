# Enhanced Naming Changelog

## 2026-11-02 (extension v2.5.5)

### Changed

- `enhanced-naming.js` and `enhanced-naming.nextgen.css` also load on `https://unifiedapp.amplience.net/*`, where the new UI now lives.

### Added

- In the Assets area, "Copy asset ID" / "Copy asset IDs" now show Tabler's `clipboard-copy` icon instead of the `copy` icon, as the button function's behaviour is more in-line with 'Copy Content ID' button (which uses `clipboard-copy`) than it is with the 'Duplicate' button (which uses `copy`).
  - CSS only: the native `<svg>`'s paths are hidden and the new shape is painted in `currentColor` via `mask`. Targeted by the exact `copy-asset-id:button` test id (single-asset menu), and by `:has([data-testid="assets-sidebar"], [data-testid="asset-create-button"])` for the bulk menu.

### Fixed

- "Copy asset ID" / "Copy asset IDs" in the media (Assets) menus no longer gets relabelled "Duplicate". The v2.5.2 menu rule had ended up matching any menu item with `.tabler-icon-copy`, which the media menus also use.
  - Single-item menu: back to the exact `[data-testid="copy:button"]` match (media's item is `copy-asset-id:button`).
  - Bulk "more actions" menu (no test ids): `:has([data-testid="content-items-sidebar"], [data-testid="content-items-create:button"]) .mantine-Menu-dropdown [role="menuitem"]:not([data-testid]):has(.tabler-icon-copy)`, i.e. only while the content listing's sidebar or create button is on the page. (Sibling items like "Set locale" vary with the selection, so they can't be relied on.)

## 2026-10-09 (extension v2.5.2)

### Added

- Nextgen UI support: `enhanced-naming.js` and the new `enhanced-naming.nextgen.css` load on `https://nextgen.amplience.net/*`.
- The "Copy" bulk action and dropdown menu item now reads "Duplicate". ("Copy" suggests a "Copy" & "Paste" behaviour and "C" has a crowded hotkey space compared to "D".)
  - The bulk action is targeted as `[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-copy) .mantine-Button-label` (using the icon rather than `:nth-of-type(2)` so the label stays on the right button if the actions are reordered).
  - The menu item is targeted as `[data-testid="copy:button"][role="menuitem"]:has(.tabler-icon-copy) .mantine-Menu-itemLabel`. Menus render in a portal, so this one isn't scoped to the listing.

---

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
