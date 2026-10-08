[< Back](../../README.md)

# Enhanced Naming Module

Drops the old names and instead spells out Amplience's app names in full on the homepage and in the app switchers, so it's clearer where each link takes you for users who don't know the acronyms. (CMS = Content Management System & DAM = Digital Asset Management)

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Enhanced Naming**
- Extension options page: toggle **Enable Enhanced Naming**

The setting key is `enhancedNamingEnabled` in `chrome.storage.sync`. It defaults to `true`.

## What It Does

As of v2.5.1, Amplience labels its two core apps **CMS** (formerly Dynamic Content) and **DAM** (formerly Content Hub), each with a short subtitle. This module swaps those labels for clearer ones:

| Where                             | Element                                                          | Shows                     |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------- |
| Homepage, first app card          | `.primary-app__subtitle`                                         | Content Management System |
| Homepage, second app card         | `.primary-app__subtitle`                                         | Digital Asset Management  |
| CMS switcher, current-app title   | `.am-switcheroo__title`                                          | CMS                       |
| CMS switcher, DAM link            | `#content-hub-link .am-switcheroo__primary-subtitle`             | Digital Asset Management  |
| DAM switcher, current-app title   | `.switcheroo .content-hub p`                                     | DAM                       |
| DAM switcher, CMS link            | `.switcheroo__primary-app--dc .switcheroo__primary-app-subtitle` | Content Management System |
| Account switcher, `/content` link | `.switcheroo-item__subtitle`                                     | Content Management System |
| Account switcher, `/media` link   | `.switcheroo-item__subtitle`                                     | Digital Asset Management  |

## How It Works

The module is CSS-only. `enhanced-naming.js` just sets or clears `data-amplience-enhanced-naming="enabled"` on `<html>` in response to the toggle (live, via `chrome.storage.onChanged`), and every rule in `enhanced-naming.css` is scoped to that attribute.

Labels are swapped without touching the DOM: the native text is hidden with `font-size: 0` and the replacement is drawn with a `::before` / `::after` pseudo-element at an explicit font size. Because Amplience's markup is left alone, its own click handlers and routing are unaffected.

## Files

- `enhanced-naming.js`: Reads the setting and toggles the gating data attribute
- `enhanced-naming.css`: The label overrides, grouped by area (homepage, CMS app, DAM app, account management)

## Development Notes

1. Keep every rule scoped to `[data-amplience-enhanced-naming="enabled"]`.
2. Hide native text with `font-size: 0` and inject replacements via pseudo-elements. Remember to set the pseudo-element's `font-size` explicitly, or it inherits the zero.
3. Homepage cards are targeted by position (`:first-child` / `:nth-child(2)`), so if Amplience reorders or adds apps, check the labels still land on the right cards.
4. Reload the extension and refresh Amplience pages to test changes.

## Troubleshooting

1. Confirm **Enable Enhanced Naming** is turned on.
2. Inspect `<html>` and verify `data-amplience-enhanced-naming="enabled"` is present.
3. If a label shows the native text, the target element has probably been renamed in a core-product release. Inspect it and update the selector; until then the native label shows through, so nothing breaks.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
