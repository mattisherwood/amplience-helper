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
- Supports a **My flows** mode\* based on initials parsed from naming convention
- Moves flows with `(Archived)` in their title into a collapsible **View Archived** section at the bottom of the list
- Provides **grid and list view toggles** for switching between flow layout modes (list view available at 1050px+ screen width)\*

\* _The user's most recent preference is saved across page loads/visits_

## Scope

This module targets Content Studio flow pages under:

- `https://app.amplience.net/content-studio/*`

## Files

- `flows-filter.js`: UI injection, filtering logic, settings listener, and view toggle behavior
- `flows-filter.css`: Styles for filter UI elements and sticky filter bar
- `table-view.css`: Styles for tabular (list) flow layout with responsive grid-based design (visible at 1050px+)
- `utils.js`: Shared helper functions for parsing/color utilities

## Troubleshooting

1. Confirm **Enable Flows Filter** is turned on.
2. Navigate to a flows view where the flows panel is rendered.
3. Check DevTools > Sources > Content scripts and verify `flows-filter.js` is injected.
4. If panel UI loaded late, wait briefly for mutation-observer injection.
