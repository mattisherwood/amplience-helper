[< Back](../../README.md)

# Dashboard Home Module

New UI only. Visiting your home page (`/<username>`) shows a placeholder dashboard instead of the app redirecting to the first repository's content list, and clicking the logo at the top of the icon bar takes you there.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Dashboard Home**
- Extension options page: toggle **Enable Dashboard Home**

The setting key is `dashboardHomeEnabled` in `chrome.storage.sync`. This module defaults to off. It responds to the toggle live, without a page reload.

## What It Does

- Stops the redirect from `/<username>` to the content list, so the URL stays put
- Fills the page area with an embedded dashboard (currently the Content Audits app in its demo mode) and swaps the header's page tabs for example dashboard tabs (the app's own Content tab row is hidden meanwhile)
- Makes the logo clickable, going to `/<username>`
- Leaves the icon bar, the hub picker and the AI button usable; choosing any icon-bar entry leaves the dashboard as normal
- Shows the icon-bar's Content entry as inactive while on the dashboard

## Scope

`nextgen.*` and `unifiedapp.*` on `amplience.net` and `amplience-qa.net` (all paths).

## Temporary: support for the live build

Until the new build (currently on QA) goes live, the module also works on the current live code. The one difference handled is the logo: on live it's already a link, to the media page, so the module cancels that navigation and goes to the dashboard instead. This is the only live-only code: the `TEMP-LIVE` block in `dashboard-home.js`'s `onDocumentClick`. Once the new build is live you can delete that block (the `preventDefault`/`stopPropagation` pair); on the new build the logo is a plain div and nothing else changes.

Whether a single-segment URL is the username root is decided by whether the icon bar's links live under it (so `/login` etc. are ignored). That applies to both builds and stays.

## Implementation Details

### Two scripts

- `dashboard-home.guard.js` runs in the page's own world (`"world": "MAIN"`, `document_start`), because only the page's own `history.replaceState` calls can be intercepted from there.
- `dashboard-home.js` runs in the extension world. It owns the toggle, the placeholder and the logo click, and sets `data-amplience-dashboard-home="enabled"` on `<html>`. The guard and all the CSS key off that attribute, so with the module off the guard does nothing.

### How the redirect is stopped

The redirect is client-side (verified 2026-11-18; the server returns 200): the router calls `history.replaceState` a few times, ending at `/<username>/content/<hub>/content-items?repoId=...`. While on the bare username path, the guard swallows those calls.

The app's router therefore believes it is on the content list while the URL says `/<username>`. That mismatch is why the placeholder is an overlay rather than a route, and it drives two details:

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

If the placeholder can't be shown, the redirect is still swallowed, so the page would sit on the content list under a `/<username>` URL. If that happens, turn the module off and update the selectors.

### Embedded dashboard

The page area is a single sandboxed iframe (`EMBED_URL` in `dashboard-home.js`) filling the pane. For now it points at the Content Audits app with `?mock`, which makes it run on simulated data with no Amplience auth. The sandbox mirrors that extension's registration (`allow-scripts allow-same-origin allow-downloads allow-popups`), minus `allow-top-navigation` until needed. The header tabs are still static placeholders (clicking only changes which one looks selected).

Next steps (not done yet): act as the extensions host (handshake, context, API request proxy) so the app can use real data without `?mock`.

## Troubleshooting

1. Confirm **Enable Dashboard Home** is on.
2. Visit `https://unifiedapp.amplience-qa.net/<username>`; the placeholder should show and the URL should stay put.
3. In DevTools, check `<html>` has `data-amplience-dashboard-home="enabled"`.
4. Check both `dashboard-home.guard.js` (page world) and `dashboard-home.js` are injected.
