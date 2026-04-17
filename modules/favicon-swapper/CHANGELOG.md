# Favicon Swapper Changelog

## 2026-04-17 (extension v2.3.0)

### Added

- New module for "favicon-swapper".
- `faviconSwapperEnabled` setting in `chrome.storage.sync` with a toggle in extension popup and options page to enable/disable the module.
- Hardcoded rules for the three main Amplience interfaces: Dynamic Content, Content Hub (DAM), and Workforce.
- Bundled `.ico` icon files per interface area.
- SPA-aware navigation handling via `pushState`, `replaceState`, `popstate`, and a `MutationObserver`.
- Tab title prepend logic for Dynamic Content (polls up to 7s for Angular hydration).
- Clean start/stop lifecycle: `MutationObserver` disconnected and `popstate` listener removed on disable; `pushState`/`replaceState` patches remain but no-op when disabled.
- `web_accessible_resources` entry added to `manifest.json` to allow pages to load the bundled icon files.
