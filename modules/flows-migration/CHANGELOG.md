# Flows Migration Changelog

## 2026-10-09 (extension v2.5.3)

### Added

- `flows-migration.nextgen.js` + `flows-migration.nextgen.css`, loaded on `https://nextgen.amplience.net/*`. Adds "Import Flow" just left of "Create new flow" on the flows listing (`/:org/flows/:hub`), and "Export Flow" just right of Run / Save in the flow editor (`/:org/flows/:hub/:flowId`). Runs and settings routes are ignored.
- Buttons are inserted as siblings of `[data-testid="actions-bar"]`, not inside it, so they don't upset the bar's own overflow measuring. The right bar is confirmed by its Tabler icon (`tabler-icon-plus` on the listing, `tabler-icon-device-floppy` in the editor).
- Nextgen URLs carry the org and hub *names*, so the hub's GraphQL ID is looked up via `viewer.organizations.cmsHubs` (cached per org/hub). It's the same ID the legacy app has in its URL, so `sourceHubId` and same-hub detection work across both UIs.
- Styled as nextgen's outlined "tertiary" button using Mantine/Amplience CSS variables (follows dark mode), and drops to icon-only below 960px wide. CSS is gated on `html[data-amplience-flows-migration="enabled"]`.
- Nextgen results show as toasts styled like nextgen's own notifications (bottom-right, success/error icon, title + description, close button). Success closes after 4 s (paused on hover); errors stay until closed. Import success is shown after the reload via a `sessionStorage` flag. Nextgen's Mantine notifications store isn't reachable from a content script (no window-event API in Mantine v7+), so these are our own elements in our own fixed container.

### Changed

- API calls, file pick/read, validation, download and the import/export pipelines moved into `flows-migration.core.js`, shared by the legacy and nextgen UIs (exposed as `globalThis.AmplienceFlowsMigration`). `flows-migration.js` now only handles legacy routing and button placement. No change in legacy behaviour other than the fixes below.
- Progress now shows in the button label ("Exporting..." / "Importing...") instead of a status line, in both UIs. The button stays disabled (normal dimmed styling) and its icon pulses via a CSS animation on `[data-busy]` (off under `prefers-reduced-motion`). In the legacy UI, results and errors still appear under the button. The core reports through `onProgress(label | null)` and `onResult({ type, message, label })` callbacks.
- No more "Choose a file..." message while the file picker is open, and cancelling the picker shows nothing.
- The JWT lookup now prefers the Auth0 cache entry for the `https://api.amplience.net` audience (nextgen keeps a separate `@@user@@` entry too), falling back to the first token found as before.

### Fixed

- Cross-hub import no longer throws if fetching the target hub's extension instances fails; the error is now shown under the button. It also skips that fetch entirely when the flow has no extension actions.
- `fetchInstances` errors were labelled "Export failed"; they now read "Import failed".

---

## 2026-06-25 (extension v2.4.7)

### Changed

- Import now detects whether the source and target hubs differ (`sameHub` check using `sourceHubId` from the export file). Instance ID remapping only runs on cross-hub imports; same-hub imports use the original flow definition unchanged.
- On cross-hub import, `reviewers` are stripped from all human-review actions before upload. User IDs from the source hub don't exist in the target hub — leaving them in caused unresolvable user references in the Workforce UI.

### Notes

- Exports created before `sourceHubId` was added to the export format are treated as cross-hub (remapping and stripping always apply) to stay safe.

---

## 2026-06-23 (extension v2.4.6)

### Fixed

- Make sure the export button is injected just after the save button. It fits better when grouped with the other buttons rather than the other side of the enabled button. (NB: We have to position it relative to the save button as we can't rely on the existence of the 'Enabled' button or not as that gets injected after page load.)

---

## 2026-06-23 (extension v2.4.5)

### Added

- Added detailed error logging to the browser console for import/export failures. Full GraphQL error payloads are now logged with `[Amplience Helper]` prefix, making debugging easier.

---

## 2026-06-11 (extension v2.4.4)

### Fixed

- Import now safely handles flows where `virtualActions` is missing, avoiding runtime errors and continuing with the original flow definition when no extension-action mapping is available.

---

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
