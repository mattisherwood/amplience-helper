[< Back](../../README.md)

# Flows Migration Module

Adds an "Export Flow" button to individual Content Flow detail pages, allowing users to download flow configurations as JSON files.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Flows Migration**
- Extension options page: toggle **Enable Flows Migration**

The setting key is `flowsMigrationEnabled` in `chrome.storage.sync`.

## What It Does

- Injects an "Export Flow" button on Content Flow detail pages
- On click, fetches the complete flow data (label, description, status, flow) via the Amplience GraphQL API
- Downloads the flow configuration as a JSON file named `flow-<flowId>.json`
- Shows inline status messages for export progress and errors

## Scope

This module targets Content Studio flow detail pages at:

- `https://app.amplience.net/content-studio/<hubId>/content-flows/<flowId>`

## Implementation Details

### Button Placement

The Export Flow button is injected into:

```
.mantine-AppShell-main > div > div > div:first-child > div > div:last-child
```

If this selector becomes unreliable due to UI changes in Amplience, the button will fail silently and no export capability will be available.

### GraphQL Query

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

### Authentication

Flow export relies on the Auth0 JWT token stored in `localStorage` under keys prefixed with `@@auth0spajs@@`. If no token is found, an authentication error will be shown inline.

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

The Export Flow button will be re-injected automatically when you navigate to a different flow within the Content Studio SPA.
