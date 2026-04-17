[< Back](../../README.md)

# Theming Module

Applies a customisable theme to the DC interface, including a dark mode.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Theming**
- Extension options page: toggle **Enable Theming**

The setting key is `themingEnabled` in `chrome.storage.sync`.

## What It Does

- Applies a dark theme to the DC interface when enabled
- Uses a data attribute on `<html>` (`data-amplience-theming="enabled"`) to scope styles
- Keeps styles isolated so disabling instantly reverts to the native Amplience UI

## Files

- `theming.js`: Reads settings and applies/removes the gating data attribute
- `theming.css`: Contains all theme overrides scoped by the data attribute

## Development Notes

1. Add or update rules in `theming.css`.
2. Keep selectors scoped to `[data-amplience-theming="enabled"]`.
