[< Back](../../README.md)

# Flows Migration Module

Adds an "Export Flow" button to individual Content Flow detail pages (in both the legacy Workforce UI and the nextgen UI), allowing users to download flow configurations as JSON files, which can later be imported to a hub by clicking the new "Import Flow" button on the flow listing page.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Flows Migration**
- Extension options page: toggle **Enable Flows Migration**

The setting key is `flowsMigrationEnabled` in `chrome.storage.sync`.

## What It Does

### Export Functionality

- Injects an "Export Flow" button on Content Flow detail pages
- On click, fetches the complete flow data (label, description, status, flow) via the Amplience GraphQL API
- Downloads the flow configuration as a JSON file named `flow-<flowId>.json`
- Shows "Exporting..." in the button while it works, then the result (legacy: under the button; nextgen: a toast)

### Import Functionality

- Injects an "Import Flow" button on the Content Flow listing page
- On click, it allows the user to select a previously downloaded JSON file
- the flow data (label, description, status, flow) is taken from the JSON file and imported into the hub via the Amplience GraphQL API
- Shows "Importing..." in the button while it works (nothing while the file picker is open), then either shows the error (legacy: under the button; nextgen: a toast) or refreshes the page to show the newly updated flow at the top of the list
- Because instanceIds are individual to the hub, one extra step before it imports the flow is to swap out the instanceIds that were relevant to the old hub with new instanceIds relevant to the new hub. (However, if the new hub doesn't have the same extension installed that will still have to be fixed manually by the user.)

## Scope

This module targets Workforce flows in both UIs:

- Legacy: `https://app.amplience.net/content-studio/<hubId>/content-flows` (import) and `.../content-flows/<flowId>` (export)
- Nextgen: `https://nextgen.amplience.net/<orgName>/flows/<hubName>` (import) and `.../flows/<hubName>/<flowId>` (export)

Export files are interchangeable between the two: same shape, same `flow-<flowId>.json` filename, and `sourceHubId` is the hub's GraphQL ID in both.

## Files

| File | Loaded on | Purpose |
| --- | --- | --- |
| `flows-migration.core.js` | both | GraphQL calls, auth, file pick/read, validation, download, and the `runExport` / `runImport` pipelines. Exposed as `globalThis.AmplienceFlowsMigration`; must be listed first in each manifest entry. |
| `flows-migration.js` + `.css` | `app.amplience.net/content-studio/*` | Legacy routing and button placement. |
| `flows-migration.nextgen.js` + `.nextgen.css` | `nextgen.amplience.net/*` | Nextgen routing, hub-name lookup and button placement. |

The UI files are kept separate (as with `hotkeys.nextgen.js`) so the legacy one can be deleted once the old app is retired.

## Implementation Details

### Legacy UI

#### Export Implementation

##### Button Placement

The Export Flow button is injected into:

```
.mantine-AppShell-main > div > div > div:first-child > div > div:last-child
```

If this selector becomes unreliable due to UI changes in Amplience, the button will fail silently and no export capability will be available.

##### GraphQL Query

The module uses the following GraphQL query to fetch flow data:

```graphql
query contentFlow($flowId: ID!) {
  contentFlow(id: $flowId) {
    label
    description
    status
    flow
  }
}
```

#### Import Implementation

##### Button Placement

The Import Flow button is injected just before the "Create Content Flow" button (Selected by the `[data-testid="add-content-flow"]` CSS selector).

If this selector becomes unreliable due to UI changes in Amplience, the button will fail silently and no import capability will be available.

##### GraphQL Query

The module uses the following GraphQL mutation to import a new flow:

```graphql
mutation createContentFlow(
  $hubId: ID!
  $label: String!
  $description: String!
  $flow: String!
) {
  createContentFlow(
    input: {
      label: $label
      description: $description
      flow: $flow
      cmsHubId: $hubId
    }
  ) {
    id
  }
}
```

And during the update of instanceIds it uses the following GraphQL query to get the relevant new instanceIds

```gql
query extensionInstances($targetHubId: ID!) {
  cmsHub(id: $targetHubId) {
    extensionInstances {
      id
      extensionRelease {
        id
      }
    }
  }
}
```

### Nextgen UI

#### Routes

Pages are detected from the URL, not the DOM:

- `/:orgName/flows/:hubName` — flows listing → Import Flow
- `/:orgName/flows/:hubName/:flowId` — flow editor → Export Flow
- `/:orgName/flows/:hubName/runs[/...]` and `.../settings/...` — ignored

The manifest matches all of `nextgen.amplience.net/*` rather than just flows routes, because moving from (say) Content to Flows is a client-side navigation, and a content script only injects on a real page load.

#### Hub ID lookup

Nextgen URLs carry names, not IDs. The hub's GraphQL ID (needed for `createContentFlow`, `cmsHub(id:)` and `sourceHubId`) is looked up once per org/hub and cached:

```graphql
query organizationHubs {
  viewer {
    organizations(first: 100) {
      edges { node { name cmsHubs { id name } } }
    }
  }
}
```

The flow ID in the editor URL is already the GraphQL ID, so export uses it as-is.

#### Button Placement

Both buttons are placed next to the page header's `[data-testid="actions-bar"]`: Import Flow just before it on the listing (left of "Create new flow"), Export Flow just after it in the editor (right of Run / Save). They're siblings rather than children because the actions bar measures its own children to collapse overflow into a menu.

To make sure it's the right bar, it must be visible and contain `button .tabler-icon-plus` (listing) or `button .tabler-icon-device-floppy` (editor). If either selector stops matching, the button simply doesn't appear.

The button elements are built once and re-attached whenever React re-renders the header, so an import or export in progress keeps its disabled state and progress label.

#### Feedback

- **Progress:** the button label changes to "Exporting..." / "Importing..." (width held so the header doesn't shift). It keeps the normal disabled styling, and the icon pulses via a CSS animation on `[data-busy]` (disabled under `prefers-reduced-motion`).
- **Results:** toasts in a fixed bottom-right container (`#ah-flows-migration-toasts`), built to look like nextgen's own Mantine notifications. We can't use the real ones: nextgen's notifications store is module-scoped inside its React bundle, and Mantine v7+ has no window-event API to reach it. Success toasts close after 4 s (paused on hover); errors stay until closed. A leading "Import failed: " / "Export failed: " is stripped from the message, since the toast title already says it.
- **Import success** reloads the page (as in legacy). The "Flow imported" toast is stashed in `sessionStorage` and shown after the reload.

#### Styling

The buttons match nextgen's outlined "tertiary" button, using Mantine/Amplience CSS variables (with fallbacks), so it follows the light/dark theme. Below 960px wide the label is hidden (the button keeps its tooltip and `aria-label`). All rules are gated on `html[data-amplience-flows-migration="enabled"]`.

#### Lifecycle

A debounced `MutationObserver` plus `pushState` / `replaceState` / `popstate` hooks call an idempotent `sync()` that adds or removes each button for the current route. Toggling the setting off disconnects the observer, removes both buttons and the root attribute without a reload.

### Authentication

Flow import/export relies on the Auth0 JWT token stored in `localStorage` under keys prefixed with `@@auth0spajs@@` (both UIs). The entry for the `https://api.amplience.net` audience is preferred; otherwise the first token found is used. If no token is found, an authentication error will be shown inline.

### File Download

Exported files are named using the pattern `flow-<flowId>.json` and contain pretty-printed JSON with the full flow configuration.

## Troubleshooting

1. Confirm **Enable Flows Migration** is turned on.
2. Navigate to an individual flow detail page (the URL should contain `/content-flows/` in the legacy UI, or `/flows/<hubName>/<flowId>` in nextgen).
3. Check DevTools > Sources > Content scripts and verify `flows-migration.core.js` and `flows-migration.js` (legacy) or `flows-migration.nextgen.js` (nextgen) are injected.
4. Check DevTools > Console for any errors prefixed with `[Amplience Helper]`.
5. If the Export Flow button doesn't appear:
   - Verify you're on a flow detail page (not the list view).
   - Check if the target container selector has changed in the Amplience UI (nextgen: `[data-testid="actions-bar"]` and its Tabler icons).
6. Nextgen "Could not determine hub ID from URL.": the org/hub names in the URL weren't found in `viewer.organizations` — check the console for the route that was looked up.
   - Hard refresh the page.

## SPA Navigation

This module watches for route changes via:

- `history.pushState` / `history.replaceState` interception
- `popstate` events
- DOM mutations

The flow migration buttons will be re-injected automatically when you navigate to a different flow within the Content Studio SPA.
