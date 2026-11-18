[< Back](../../README.md)

# Dashboard Home Module

New UI only. Visiting your client's home page (`/client-<id>`) shows a placeholder dashboard instead of the app redirecting to the first repository's content list, and clicking the logo at the top of the icon bar takes you there.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Dashboard Home**
- Extension options page: toggle **Enable Dashboard Home**

The setting key is `dashboardHomeEnabled` in `chrome.storage.sync`. This module defaults to off. It responds to the toggle live, without a page reload.

## What It Does

- Stops the redirect from `/client-<id>` to the content list, so the URL stays put
- Covers the page area with a placeholder dashboard (title, actions area and body), and swaps the header's page tabs for example dashboard tabs (the app's own Content tab row is hidden meanwhile)
- Makes the logo clickable, going to `/client-<id>`
- Leaves the icon bar, the hub picker and the AI button usable; choosing any icon-bar entry leaves the dashboard as normal
- Shows the icon-bar's Content entry as inactive while on the dashboard

## Scope

`nextgen.*` and `unifiedapp.*` on `amplience.net` and `amplience-qa.net` (all paths).

## Implementation Details

### Two scripts

- `dashboard-home.guard.js` runs in the page's own world (`"world": "MAIN"`, `document_start`), because only the page's own `history.replaceState` calls can be intercepted from there.
- `dashboard-home.js` runs in the extension world. It owns the toggle, the placeholder and the logo click, and sets `data-amplience-dashboard-home="enabled"` on `<html>`. The guard and all the CSS key off that attribute, so with the module off the guard does nothing.

### How the redirect is stopped

The redirect is client-side (verified 2026-11-18; the server returns 200): the router calls `history.replaceState` a few times, ending at `/client-<id>/content/<hub>/content-items?repoId=...`. While on the bare client path, the guard swallows those calls.

The app's router therefore believes it is on the content list while the URL says `/client-<id>`. That mismatch is why the placeholder is an overlay rather than a route, and it drives two details:

- A replace that follows a real click or keypress is let through (so the user is never trapped), apart from clicks on the logo, which would otherwise let the redirect through.
- Clicking the icon-bar link for the page the router thinks it is already on does nothing in the app, so after a click on an icon-bar link, if the URL is still the dashboard 150ms later, the module routes to that link itself (`pushState` plus a `popstate` event, as the browser's back button does).

### Selectors

CSS-module class names are hashed, so only `data-testid` / `aria` hooks are used:

| Selector | Used for | If it disappears |
| --- | --- | --- |
| `[data-testid="icon-bar:logo"]` | The logo link | Logo isn't clickable; the dashboard is still reachable by URL |
| `[data-testid="app-header:portal"]` | Where the placeholder's tabs sit; the app's own tab row there is hidden while the placeholder is up | Placeholder isn't shown, or the app's Content tab shows through behind ours |
| `[data-testid="app-shell"] main` | The area the placeholder covers | Placeholder isn't shown |
| `[data-testid="icon-bar"] a[aria-current="page"]` | Un-highlighting Content | Content stays highlighted on the dashboard |

If the placeholder can't be shown, the redirect is still swallowed, so the page would sit on the content list under a `/client-<id>` URL. If that happens, turn the module off and update the selectors.

### Placeholder

The tabs, title and actions area are static placeholders (tab clicks only change which tab looks selected) ready to be swapped for real dashboards.

## Troubleshooting

1. Confirm **Enable Dashboard Home** is on.
2. Visit `https://unifiedapp.amplience-qa.net/client-<id>`; the placeholder should show and the URL should stay put.
3. In DevTools, check `<html>` has `data-amplience-dashboard-home="enabled"`.
4. Check both `dashboard-home.guard.js` (page world) and `dashboard-home.js` are injected.
