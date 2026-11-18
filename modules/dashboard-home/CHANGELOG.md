# Dashboard Home Changelog

## 2026-11-18 (extension v2.7.0)

### Added

- New optional Dashboard Home module for the new UI.
- Stops the redirect from `/client-<id>` to the content list and shows a placeholder dashboard there instead.
- Clicking the logo at the top of the icon bar now goes to the dashboard.
- New `dashboardHomeEnabled` toggle stored in `chrome.storage.sync`, wired into both popup and options.

### Notes

- Module defaults to off.
- Relies on `data-testid` hooks for the logo, header and page area; if they change, the logo stops being clickable or the placeholder isn't shown.
