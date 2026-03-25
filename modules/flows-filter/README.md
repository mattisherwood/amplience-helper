[< Back](../../README.md)

# Flows Filter Module

Adds filtering controls for Workforce Content Flows in Amplience Content Studio.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Flows Filter**
- Extension options page: toggle **Enable Flows Filter**

The setting key is `flowFilter` in `chrome.storage.sync`.

## What It Does

- Injects a flow filter UI into the flows panel
- Supports text filtering with debounce
- Supports quick tag filtering controls
- Supports a **My flows** mode based on initials parsed from naming convention

## Scope

This module targets Content Studio flow pages under:

- `https://app.amplience.net/content-studio/*`

## Files

- `flows-filter.js`: UI injection, filtering logic, and settings listener
- `flows-filter.css`: Styles for filter UI elements
- `utils.js`: Shared helper functions for parsing/color utilities

## Troubleshooting

1. Confirm **Enable Flows Filter** is turned on.
2. Navigate to a flows view where the flows panel is rendered.
3. Check DevTools > Sources > Content scripts and verify `flows-filter.js` is injected.
4. If panel UI loaded late, wait briefly for mutation-observer injection.
