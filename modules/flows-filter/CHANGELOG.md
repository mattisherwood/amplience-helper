# Flows Filter Changelog

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
