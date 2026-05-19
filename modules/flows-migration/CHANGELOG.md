# Flows Migration Changelog

## 2026-05-19 (extension v2.4.1)

### Fixed

- **Import bug**: when importing a flow with no interfaceId mappings (e.g. a flow with no extensions, or importing into the same hub), the code was building an empty regex string (`new RegExp("", "g")`) which replaced every character position and corrupted the flow JSON. The regex replacement is now skipped entirely when the mapping is empty, and the original flow string is used as-is.

### Changed

- Button styling updated to use a transparent background with a bordered outline, matching the Amplience UI more closely.
- Import/export status messages are now positioned absolutely beneath their respective buttons (instead of inline).
- `font-size` and `white-space` styles removed from inline JS and consolidated into the `.flows-migration-status` CSS class.
- CSS selector updated from `> div:first-child` to `> .mantine-Flex-root` for more precise and resilient button-row targeting.

---

## 2026-05-15 (extension v2.4.0)

### Added

- **Export Flow Functionality**
  - New "Export Flow" button on individual Content Flow detail pages in Content Studio
  - Fetches complete flow configuration via GraphQL API using Auth0 JWT authentication
  - Downloads flow data as `flow-<flowId>.json` file
- **Import Flow Functionality**
  - New "Import Flow" button on the Content Flow listing page in Content Studio
  - Allows the user to upload a previously exported json file
  - Swaps out instanceIds for new ones should the user be importing it into a different hub
  - Uses the data to create a new matching flow in the hub
- Shows inline status messages for import/export progress and errors
- New `flowsMigrationEnabled` toggle stored in `chrome.storage.sync`, wired into popup and options
- Module automatically injects/removes the buttons when enabled/disabled without page reload
- Handles SPA navigation (route changes within Content Studio stay responsive)

### Notes

- Module defaults to enabled
- Button placement targets the flow detail page header; if selector changes in Amplience, button may not appear
- Requires valid Auth0 session; fails gracefully with error message if token is unavailable
- Import always creates a new flow. It _doesn't_ currently check for an existing flow matching the ID from the filename
- There is a bug in the mantine tab-switching where it doesn't always change the URL, which can mean the injection/removal of the buttons isn't triggered. This needs fixing.
- Flows can be exported from one hub and imported into another.
- The import also handles the swapping of interfaceIds when moving between hubs. But if the new hub doesn't have the same extensions enabled you will need to fix that part manually.
- One complication with cross-hub flow migration is the webhook IDs have to be updated manually after import. This could hopefully be addressed in a future update.
