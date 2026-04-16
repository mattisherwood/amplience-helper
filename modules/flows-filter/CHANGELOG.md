# Flows Filter Changelog

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
