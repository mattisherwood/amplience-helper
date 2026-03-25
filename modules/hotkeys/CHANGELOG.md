# Hotkeys Changelog

> Prior to integration into `amplience-patches`, Hotkeys was maintained as a standalone extension (`amplience-hotkeys`). Version numbers below reflect that lineage.

## 2026-03-25 (extension v2.0)

### Changed

- No functional changes. Integrated from standalone `amplience-hotkeys` into `amplience-patches`; now toggle-controlled via `chrome.storage.sync` alongside other modules.

---

## 2026-03-03 (standalone v1.5)

### Added

- **F2** to rename items (listing page when one item is selected, and in editor).
- **Enter** to open the currently selected item (listing page, single selection).
- **F1** to open Amplience documentation in a new tab.
- **Ctrl/Cmd + F** search support inside the create content modal.
- Keyboard navigation support for schema listing pages.

### Changed

- **F** filter enhancement: after opening filters, typing letters immediately narrows content-type filter options (e.g. "pa" → "page").
- Improved **Escape** and **Enter** key handling inside the filters panel and create content modal.

---

## 2026-02-26 (standalone v1.4)

### Added

- Tooltip titles on relevant buttons showing the associated keyboard shortcut, for discoverability on repeated clicks.

---

## 2026-01-29 (standalone v1.3)

### Added

- **D** for Duplicate.
- **L** for Localize.

### Changed

- **A** is now consistently "Assign user" across listing and editor pages.
- Standardised hotkeys to match across listing and editor contexts where possible.
- Grouped hotkeys into Global / Listing Page / Editor Page sections in the help overlay.

### Removed

- **A** for "navigate to archive" (superseded by the consistent Assign user binding).

### Notes

- Known bug remains with the core assign-user button in Amplience.

---

## 2026-01-23 (standalone v1.2.1)

### Fixed

- Ctrl + number keys now pass through to native browser behaviour (e.g. Ctrl+0 resets zoom).

---

## 2026-01-23 (standalone v1.2)

### Added

- **C** to create a new content item.
- **S** or **Ctrl/Cmd + S** to save the current content item.

### Changed

- Hotkeys scoped and limited appropriately when the create content modal is open.

---

## 2026-01-23 (standalone v1.1)

### Added

- **A** to navigate to archive.
- **P** to publish selected items.
- **U** to unarchive (when in archive) or assign user (outside archive).

### Changed

- Hotkeys categorised in help overlay and documentation.

---

## 2026-01-23 (standalone v1.0)

### Added

- Initial release.
- **Ctrl/Cmd + A** to select all.
- **Esc** to deselect all.
- **E** to archive.
- **F** to open/close filters.
- **Ctrl/Cmd + F** to focus the find input.
- **H** or **?** to show help overlay.
- Number keys (1–0) to open corresponding top-level menu items.
