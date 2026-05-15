[< Back](../../README.md)

# Flows Migration Module

Adds an "Export Flow" button to individual Content Flow detail pages, allowing users to download flow configurations as JSON files, which can later be imported to a hub by clicking the new "Import Flow" button on the flow listing page.

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
- Shows inline status messages for export progress and errors

### Import Functionality

- Injects an "Import Flow" button on the Content Flow listing page
- On click, it allows the user to select a previously downloaded JSON file
- the flow data (label, description, status, flow) is taken from the JSON file and imported into the hub via the Amplience GraphQL API
- Shows inline status messages for export progress and errors or refreshes the page to show the newly updated flow at the top of the list

## Scope

This module targets Content Studio flow detail pages at:

- `https://app.amplience.net/content-studio/<hubId>/content-flows/<flowId>`

## Implementation Details

### Export Implementation

#### Button Placement

The Export Flow button is injected into:

```
.mantine-AppShell-main > div > div > div:first-child > div > div:last-child
```

If this selector becomes unreliable due to UI changes in Amplience, the button will fail silently and no export capability will be available.

#### GraphQL Query

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

### Import Implementation

#### Button Placement

The Import Flow button is injected just before the "Create Content Flow" button (Selected by the `[data-testid="add-content-flow"]` CSS selector).

If this selector becomes unreliable due to UI changes in Amplience, the button will fail silently and no import capability will be available.

#### GraphQL Query

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

### Authentication

Flow import/export relies on the Auth0 JWT token stored in `localStorage` under keys prefixed with `@@auth0spajs@@`. If no token is found, an authentication error will be shown inline.

### File Download

Exported files are named using the pattern `flow-<flowId>.json` and contain pretty-printed JSON with the full flow configuration.

## Troubleshooting

1. Confirm **Enable Flows Migration** is turned on.
2. Navigate to an individual flow detail page (the URL should contain `/content-flows/`).
3. Check DevTools > Sources > Content scripts and verify `flows-migration.js` is injected.
4. Check DevTools > Console for any errors prefixed with `[Amplience Helper]`.
5. If the Export Flow button doesn't appear:
   - Verify you're on a flow detail page (not the list view).
   - Check if the target container selector has changed in the Amplience UI.
   - Hard refresh the page.

## SPA Navigation

This module watches for route changes via:

- `history.pushState` / `history.replaceState` interception
- `popstate` events
- DOM mutations

The flow migration buttons will be re-injected automatically when you navigate to a different flow within the Content Studio SPA.
