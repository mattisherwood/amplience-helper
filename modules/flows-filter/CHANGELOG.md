# Flows Filter Changelog

## 2026-08-14 (extension v2.4.12)

### Fixed

- Flow cards stopped decorating entirely (`Cannot read properties of undefined (reading 'children')`) after a core-product release inserted an extra wrapper `div` between the card surface and its contents, so `children[0].children[1]` no longer resolved. Because the exception was thrown on the first card, every downstream feature - author badges, tags, tag chips, archiving and table view - died with it.
- Amplience's fixed inline card height moved onto that new wrapper, so the `height: auto` override that lets tagged cards grow was being applied to the wrong element.

### Changed

- Card parts are no longer found by walking fixed child indexes. The stage (title + description) is derived from the title `<p>` via `closest(".mantine-Stack-root")`, and the surrounding parts are resolved relative to it. This is the fourth DOM-shape break in five months, so the traversal is now structure-agnostic rather than re-indexed.
- Located parts are stamped with `data-flow-part="body|meta|content|stage|actions"`, and both stylesheets target those roles instead of nesting depth (`> div > div > .mantine-Group-root`). A data attribute is used rather than a class because React overwrites `className` when it re-renders a card.
- Decoration is now wrapped per card: a card that can't be parsed or decorated is left as stock Amplience and the rest of the list still filters, instead of one failure taking down the whole panel. Failures log a single `console.warn`.
- Search matching is now consistently scoped to the title and description. The final filter pass previously matched against the whole card's text, which since the release includes the "Last run" chip - so searching "run" matched every flow.

---

## 2026-06-25 (extension v2.4.7)

### Fixed

- Updated card content traversal to match Amplience's revised flow card DOM structure. The selector used to locate the stage element (for author badge injection) changed from `children[0].children[0]` to `children[0].children[1]`, and the target from the last child to the first child of that container.
- Updated table view CSS to work with Amplience's revised flow card DOM structure.

---

## 2026-06-02 (extension v2.4.3)

### Fixed

- Updated flows filter code to work with the latest core-product release.

---

## 2026-05-19 (extension v2.4.1)

### Added

- Table view header row (columns: Name, Description, Last Run, Actions, Author, Tags) that inserts at the top of the flow list when table/list view is active, and is removed when switching back to grid view.
- `isFlowCardElement()` helper to reliably exclude the header (and the archived section) from flow-card operations such as parsing, archiving, and filtering.

### Fixed

- Content-container lookup in the `tableViewEnabled` storage-change handler was targeting the wrong parent element; now correctly resolves relative to `#flow-filter-wrapper`.

### Changed

- Border-radius values standardised to `var(--mantine-radius-sm)` throughout (search input, clear button, tag pills, archive badge).
- Author badge gains `align-self: center` in table view rather than stretching to fit.

---

## 2026-05-15 (extension v2.3.10)

### Changed

- Removed console.logs

---

# 2026-05-14 (extension v2.3.9)

### Added

- Grid/list view toggle buttons with persistent view preference storage (`tableViewEnabled` setting).
- Sticky filter bar that remains visible while scrolling through the flows list.
- `table-view.css` stylesheet with tabular layout styles (6-column grid layout, responsive at 1050px+).
- Improved search highlighter scope limiting to only highlight within title, description & time badge, not tags etc.
- Better grid layout alignment for archived flows section using CSS Grid subgrid.
- Popover z-index handling to prevent overlap with view toggle buttons.

### Changed

- Filter bar background styling for improved visual hierarchy and readability.
- Archived section now uses CSS Grid subgrid for better alignment with main flow list.
- Search highlighting now targets only the relevant flow card content area.
- Now considers "Org" as one of your flows in the "My flows" filter

### Notes

- Grid/list view toggle is only visible at screen widths ≥1050px.
- Grid layout (default) shows flows in a flexible grid; list layout shows flows in a 6-column table format with separated rows.
- View preference survives page reloads and navigation.

---

# 2026-05-06 (extension v2.3.4)

### Fixed

- Add better padding to the flow filter

---

# 2026-04-28 (extension v2.3.2)

### Added

- Detect tags in the description as well as the title (and de-duplicate)

### Changed

- Support for hyphenated tags

---

# 2026-04-22 (extension v2.2.4)

### Added

- Real-time search term highlighter

---

## 2026-04-15 (extension v2.1.2)

### Added

- Flows with `(Archived)` in their title are automatically moved to a collapsible **View Archived** section at the bottom of the list, collapsed by default.
- Search, tag, and **My flows** filters apply within the archived section the same as regular flows.

---

## 2026-03-26 (extension v2.1.1)

### Changed

- Author initials are now matched anywhere in the flow title (not just the start), and capped at 1–3 characters between brackets. Titles where the author tag appears mid-string or at the end are now included in the parsing.
- "My flows" toggle state is now persisted to `chrome.storage.sync` and restored on page load, rather than resetting when the flows panel re-renders.

---

## 2026-03-25 (extension v2.0)

### Changed

- No functional changes. Extension restructured and renamed; module renamed from `content-flows-filter` to `flows-filter` internally.

---

## 2026-03-13 (extension v1.5.1)

### Added

- Detects the current user's initials and highlights their flows in the panel.
- "My flows" toggle to switch between showing all flows and the current user's only.

### Notes

- Initials are matched from the flow title naming convention only. A usability convenience, not full RBAC identity.

---

## 2026-03-11 (extension v1.5)

### Added

- Extracts author and tag data from flow titles based on naming convention.

---

## 2026-02-24 (extension v1.4)

### Added

- Filter input injected into the flows panel with real-time text matching.
- Clear button for the filter input.
- 100ms debouncing for filter performance.
- `flowFilter` flag added to settings structure.
- Mutation observer to inject filter UI when the panel loads dynamically.

### Changed

- Content script extended to support `content-studio/content-flows` URLs.
- `data-visibility` attributes with CSS used to hide/show filtered items (no DOM removal).
- Toggle for flows filter added to popup, options, and context menu.
