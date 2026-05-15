# Flows Migration Changelog

## 2026-05-15 (extension v2.4.0)

### Added

- New "Export Flow" button on individual Content Flow detail pages in Content Studio
- Fetches complete flow configuration via GraphQL API using Auth0 JWT authentication
- Downloads flow data as `flow-<flowId>.json` file
- Shows inline status messages for export progress and errors
- New `flowsMigrationEnabled` toggle stored in `chrome.storage.sync`, wired into popup and options
- Module automatically injects/removes button when enabled/disabled without page reload
- Handles SPA navigation (route changes within Content Studio stay responsive)

### Notes

- Module defaults to enabled
- Button placement targets the flow detail page header; if selector changes in Amplience, button may not appear
- Requires valid Auth0 session; fails gracefully with error message if token is unavailable
- Only available on individual flow detail pages (`/content-studio/.../content-flows/<flowId>`), not on flow list pages
