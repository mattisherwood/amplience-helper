# Dashboard Home Changelog

## 2026-11-19 (extension v2.7.1)

### Removed

- The temporary support for the old live build (the `TEMP-LIVE` block in `dashboard-home.js` that cancelled the logo's link to the media page). The new build is live, where the logo is a plain element, so it is no longer needed.

### Fixed

- The Content overview tab was blank: `dashboard-home.overview.js` was missing from the content script list in `manifest.json`, so `AmplienceDashboardHomeOverview` was undefined and rendering threw. Now loaded after `dashboard-home.host.js` and before `dashboard-home.js`.

## 2026-11-18 (extension v2.7.0)

### Added

- New optional Dashboard Home module for the new UI.
- The page shows the Dashboard-category extensions registered on the current hub as tabs, each run in a sandboxed iframe with the extension host protocol handled by `dashboard-home.host.js`. API calls use the signed-in user's own token, limited to the extension's registered Read/Modify permissions.
- A built-in "Content overview" tab, first in the list and shown by default: six donut charts (content type, assigned to, status, publish status, last modified, locale) with hover tooltips, a "Content Operations Dashboard" title, and a Repository filter (default All) to restrict the counts to one content repository.
- Switching hub from the dashboard keeps you on the dashboard (showing the new hub's content overview and dashboards) instead of jumping to the content list.
- The logo gets the same white highlight tile as the icon bar's active items while the dashboard is showing.
- Stops the redirect from `/<username>` to the content list and shows a placeholder dashboard there instead.
- Clicking the logo at the top of the icon bar now goes to the dashboard.
- Also works on the current live build (logo already a link) until the new build goes live. The live-only part is marked `TEMP-LIVE` in `dashboard-home.js`.
- New `dashboardHomeEnabled` toggle stored in `chrome.storage.sync`, wired into both popup and options.

### Notes

- Module defaults to off.
- Relies on `data-testid` hooks for the logo, header and page area; if they change, the logo stops being clickable or the placeholder isn't shown.
