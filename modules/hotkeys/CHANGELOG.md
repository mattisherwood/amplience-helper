# Hotkeys Changelog

## 2026-11-02 (extension v2.5.5)

### Changed

- `hotkeys.keycast.js` + `hotkeys.nextgen.js` also load on `https://unifiedapp.amplience.net/*`, where the new UI now lives.

### Added

- New `flowRun` page (`/:org/flows/:hub/:flowId/run/:runId`, "While Viewing a Flow Run"), which previously only got the global hotkeys: `V` toggles the Flow view panel (`[data-testid="icon-bar-tab-view flow"]`).

## 2026-10-15 (extension v2.5.4)

### Added

- Asset listing hotkeys (nextgen) extended beyond `Ctrl/Cmd + U` (Upload): `P` publish, `+` add to collection, `Enter` open, `F` filters, `Ctrl/Cmd + F` find, `V` list/grid view, `→` / `←` pagination, `Ctrl/Cmd + A` select all and `Esc` deselect all. Most reuse the content listing's selectors; Open targets `.tabler-icon-photo-share` and select-all targets `[data-testid="checkbox"]`.

- "Show hotkeys on screen" demo option (`hotkeysKeycastEnabled`, default off), on the options page only, nested under Enable Hotkeys. New `hotkeys.keycast.js` is loaded ahead of both `hotkeys.js` and `hotkeys.nextgen.js` and shows the pressed keys (e.g. `⌘ A`) in a small dark tile bottom-centre for 2s, with a 0.2s scale + fade in/out (opacity only under `prefers-reduced-motion`). Styles in `hotkeys.css`, gated on `html[data-amplience-hotkeys-keycast="enabled"]`.

### Changed

- Nextgen `?` cheatsheet now orders its columns as Global, then the current page (from `currentPage()`), then the remaining pages in `HOTKEYS` order.
- README hotkey tables now cover the nextgen UI (generated from `HOTKEYS`) as well as the classic UI. Classic tables corrected against `hotkeys.js`: added `F1`, `F2`, `Enter` and the schema/content-type pages; listing `U` is Unarchive only; removed editor `U`, which isn't implemented.
- Legacy `handleKeydown` is now a thin wrapper around `runHotkeys`, and detects a fired hotkey by the event becoming `defaultPrevented`.
- Legacy listing `Enter` (open selected item) and `F2` (rename) now call `event.preventDefault()` synchronously, so they register as fired hotkeys. F2's previous call ran inside a `setTimeout`, after the event had already finished.

- Esc shows in the keycast on every press, from a capture-phase `window` listener in `hotkeys.keycast.js` that only observes the event. That covers modals and dropdowns the apps close natively. The keycast is only active while Hotkeys is on too.

### Notes

- Mac detection is case-insensitive, because `navigator.userAgentData.platform` reports `macOS`.
- The keycast only appears when a hotkey actually acted (e.g. `E` with nothing selected won't show).

## 2026-10-08 (extension v2.5.2)

### Added

- `hotkeys.nextgen.js`, loaded on `https://nextgen.amplience.net/*` with `hotkeys.css` (for the help overlay). It's separate from `hotkeys.js`, which stays legacy-only, because the AngularJS selectors, page detection and init loop don't carry over to the React/Mantine app.
- Pages are detected from the URL (`/:org/content/:hub/content-items[/:id]`, `.../content-types[/:id]`, and `/:org/media/:hub` for the asset listing) rather than from DOM components.
- Flows listing (`/:org/flows/:hub`) and flow runs listing (`/:org/flows/:hub/runs`) hotkeys: `Ctrl/Cmd + F` focuses each page's search field. `focus` targets now accept either the field itself or a wrapper around it.
- Flow editor (`/:org/flows/:hub/:flowId`) hotkeys: `Ctrl/Cmd + S` saves the flow. A new `preventDefault: true` entry option blocks the browser's own Save dialog even when the save button is missing or disabled.
- Reviews listing (`/:org/reviews/:hub`) hotkeys: `F` toggles the filters, and `Ctrl/Cmd + F` focuses the search field.
- Asset listing hotkeys, starting with `Ctrl/Cmd + U` (Upload, `[data-testid="asset-upload-button"]`).
- One `HOTKEYS` table drives the keydown handler, the "Label (Key)" button tooltips and the `?` help overlay. Tooltips are tracked with a `data-amplience-hotkey` marker and removed when the module is disabled.
- Active so far: `?` (help), plus `C` (create) and `V` (toggle list/grid) on the listing. The rest of the legacy set is in the table, commented out with `target: "TODO"`, to be enabled one at a time. Not ported: number-key navigation, and Esc for closing modals (Mantine handles that natively).
- Page hotkeys are suppressed while a Mantine modal is visibly open (a rendered `.mantine-Modal-content`; some modals stay mounted while closed). While typing in a text field (text-type inputs, textareas, selects and contenteditable), only Ctrl/Cmd combos fire. Focus on checkboxes, radios, buttons and other non-text inputs doesn't pause hotkeys, so V keeps working after it focuses the view toggle's radio.
- Esc in a text field blurs it, so the page hotkeys work again straight away. It's skipped while the field's dropdown is open (`aria-expanded="true"`), so Esc closes that first, and the event isn't stopped, so modals still close on Esc as normal.

---

## 2026-06-11 (extension v2.4.4)

### Fixed

- Arrow-key pagination hotkeys (→ and ←) now fire correctly on listing page and schema listing pages. Previous condition was checking the function reference instead of calling it.

### Added

- New "S" hotkey for bulk-selection Sync action on listing page.
- New "T" hotkey for bulk-selection Tag action on listing page.
- Schema listing pagination now also applies to content-types pages.

## 2026-05-07 (extension v2.3.7)

### Changed

- Apply more reliable deselection rules
- Allow hotkey-filtering when filters clicked open as well as when they were 'hotkeyed' open

---

## 2026-05-07 (extension v2.3.6)

### Added

- Tooltip when content-type filter is listening
- Real-time highlighting when content-type filter is listening

### Changed

- Extracted CSS into a separate file for good practice & ease of management

---

> Prior to integration into `amplience-helper`, Hotkeys was maintained as a standalone extension (`amplience-hotkeys`). Version numbers below reflect that lineage.

---

## 2026-03-25 (extension v2.0)

### Changed

- No functional changes. Integrated from standalone `amplience-hotkeys` into `amplience-helper`; now toggle-controlled via `chrome.storage.sync` alongside other modules.

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
