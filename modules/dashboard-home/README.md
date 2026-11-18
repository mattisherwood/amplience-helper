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

`nextgen.amplience.net` and `unifiedapp.amplience.net` (all paths).

## Temporary: support for the live build

Until the new build goes live, the module also works on the current live code. The one difference handled is the logo: on live it's already a link, to the media page, so the module cancels that navigation and goes to the dashboard instead. This is the only live-only code: the `TEMP-LIVE` block in `dashboard-home.js`'s `onDocumentClick`. Once the new build is live you can delete that block (the `preventDefault`/`stopPropagation` pair); on the new build the logo is a plain div and nothing else changes.

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

### Logo highlight

While the dashboard shows (`data-amplience-dashboard-home-active` on `<html>`), the logo gets the same white rounded tile the icon bar puts behind its active item (the app's hashed `_focus_` span). It is a `::before` on `[data-testid="icon-bar:logo"]` with matching CSS (`inset: 0`, `--mantine-radius-md`, white, `z-index: 0`), and the logo's `svg` is lifted above it; no DOM is injected. If the logo selector disappears the tile just doesn't show.

### Switching hub on the dashboard

The hub picker keeps the current page type when you switch hub, and on the dashboard the router believes it is on the content list, so it would navigate to the new hub's content list. The guard therefore also watches for a click on an option (`.mantine-Combobox-option`) while `[data-testid="hub-select"][data-expanded="true"]` exists, and for 1.5 s afterwards swallows both `pushState` and `replaceState` from the username root. It records the target hub in `data-amplience-dashboard-home-hub`, bumping `-hub-seq`, and `dashboard-home.js` follows it (reloading the tabs and report for the new hub). If either selector changes, a hub switch on the dashboard jumps to content as before.

### Content overview (built-in dashboard)

`dashboard-home.overview.js` draws the first tab, "Content overview", which is also the default: the old UI's content report as six SVG donuts (content type, assigned to, status, publish status, last modified, locale) with the title in the middle and a tooltip (`label (count)`) on hover. It is built into the module, not an extension, so it appears on every hub.

- **Data:** one `POST /hubs/{id}/content-items/facet?query=status:"ACTIVE"` with ENUM facets (`schema`, `assignees`, `workflow.state`, `publishingStatus`, `locale`) plus four named DATE facets on `lastModifiedDate` (7/30/90/365 days; these are cumulative, so the script subtracts them into separate slices, and "Older" is the total minus the year). The total is the sum of the `schema` counts.
- **Names:** content type labels from `/content-types` (`settings.label`, matched on `contentTypeUri`), workflow states from `/workflow-states`, users from the auth service's `/users` (via the host). Any of these failing just falls back to ids.
- **Title:** an `<h1>` "Content Operations Dashboard" above the report card, inside the scrolling page area (shown once the report has loaded).
- **Filter:** a native `<select>` styled as a pill ("Repository [ All ]"), top-right of the report body on the item-count row. Repositories come from `/content-repositories`; choosing one re-runs only the facet request with `contentRepositoryId:"<id>"` added to the query (names are fetched once), and the latest choice wins if you change it mid-load. No other filters yet.
- **Colours:** largest slice first, clockwise from 12 o'clock; "none" slices (unassigned, no status, unpublished, not localised) are pale lavender; publish status and last modified use fixed colours.

### Dashboard extensions host

`dashboard-home.host.js` (loaded before `dashboard-home.js`, exposed as `globalThis.AmplienceDashboardHomeHost`) lets Dashboard-category extensions registered on the current hub run on the page until the app does it natively.

- **Which hub:** the hub name from the last `/<username>/content|flows/<hub>` URL seen, or from the redirect the guard swallowed (`data-amplience-dashboard-home-hub` on `<html>`). No hub known: the page asks the user to open one first.
- **Registry:** pages through `GET /v2/content/hubs` to match the hub by `name`, then lists its extensions and keeps `category: DASHBOARD` + `status: ACTIVE`. Each becomes a header tab. Sandbox flags and READ/EDIT permissions come from the registration's `settings`.
- **Host protocol:** a hand-written version of the host side of `dc-extensions-sdk` / `message-event-channel` (`mc-name` handshake over a MessagePort, `mc-handshake`, `context-get`, `dc-management-sdk-js:request`). Anything else is rejected with 501.
- **Auth:** API calls use the signed-in user's own Auth0 access token, read from localStorage (`getAccessToken`, same logic as `flows-webhooks.core.js`, duplicated on purpose). It is only ever used in this script's `fetch` calls; the extension sees responses, never the token. Requests are only sent to the Amplience API origins, and writes need the extension's Modify permission. Worth stating in the Web Store privacy disclosure.
- **Known gaps:** `applicationNavigator` links point at the classic app (`allow-top-navigation` is needed for them to work); `sdk.users.list()` works (it reads the auth service's `/users`), but its GraphQL organisation-member lookup is rejected, so org members who are not in that list will be missing. Other GraphQL requests are unsupported.

## Troubleshooting

1. Confirm **Enable Dashboard Home** is on.
2. Visit `https://unifiedapp.amplience.net/<username>`; the placeholder should show and the URL should stay put.
3. In DevTools, check `<html>` has `data-amplience-dashboard-home="enabled"`.
4. Check both `dashboard-home.guard.js` (page world) and `dashboard-home.js` are injected.
