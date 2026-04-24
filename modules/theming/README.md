[< Back](../../README.md)

# Theming Module

Applies a customisable theme to the DC interface, including per-hub colour and dark mode settings.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable DC Theming**
- Extension options page: toggle **Enable DC Theming**

The main setting key is `themingEnabled` in `chrome.storage.sync`.

Per-hub values are stored in `themingHubs`, keyed by hub name:

```js
{
	themingHubs: {
		thehubname: {
			label: "The Hub Name",
			color: "3, 116, 221",
			isDark: false,
		},
	},
}
```

## What It Does

- Applies a dark theme to the DC interface when enabled
- Uses a data attribute on `<html>` (`data-amplience-theming="enabled"`) to scope styles
- Keeps styles isolated so disabling instantly reverts to the native Amplience UI
- Resolves the active hub from the URL and applies that hub's saved theme values
- Auto-creates a default entry for new hubs and attempts to cache a friendly hub label from the DC hub selector
- Exposes per-hub controls in popup/options (label, colour, dark toggle, remove)

## Files

- `theming.js`: Resolves current hub, reads per-hub settings, applies/removes the gating data attribute, and updates theme variables/classes
- `theming.css`: Contains all theme overrides scoped by the data attribute

## Development Notes

1. Add or update rules in `theming.css`.
2. Keep selectors scoped to `[data-amplience-theming="enabled"]`.
