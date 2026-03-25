[< Back](../../README.md)

# Style Patches Module

Applies responsive and readability CSS improvements to Amplience pages.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Styles Patch**
- Extension options page: toggle **Enable Styles Patch**

The setting key is `stylesEnabled` in `chrome.storage.sync`.

## What It Does

- Applies CSS improvements only when enabled
- Uses a data attribute on `<html>` (`data-amplience-patches="enabled"`) to scope styles
- Keeps styles isolated so disabling instantly reverts to native Amplience UI

## Files

- `style-patches.js`: Reads settings and applies/removes the gating data attribute
- `style-patches.css`: Contains all style overrides scoped by the data attribute

## Development Notes

1. Add or update rules in `style-patches.css`.
2. Keep selectors scoped to `[data-amplience-patches="enabled"]`.
3. Reload extension and refresh Amplience pages to test changes.

## Troubleshooting

1. Confirm **Enable Styles Patch** is turned on.
2. Inspect `<html>` and verify `data-amplience-patches="enabled"` is present.
3. Check DevTools > Sources > Content scripts to ensure `style-patches.js` is injected.
