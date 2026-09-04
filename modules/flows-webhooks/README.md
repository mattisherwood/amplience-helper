[< Back](../../README.md)

# Flows Webhooks Module

Adds a **Webhooks** tab to the Workforce flows list, showing every webhook URL in the current hub. Amplience only exposes these from the webhook library inside a flow edit screen, and truncates the URLs there, so getting a hook URL out of the platform normally means opening a flow you didn't want to edit.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Flows Webhooks**
- Extension options page: toggle **Enable Flows Webhooks**

The setting key is `flowsWebhooksEnabled` in `chrome.storage.sync`. It defaults to `false`.

## What It Does

- Injects a fourth tab, **Webhooks**, alongside Flows / Runs / Reviews on the flow listing page
- Lists every webhook listener in the hub, sorted by label
- Shows each hook's security type as a badge (`None`, `Hmac`, …) under a **Security** column heading
- Expands each row to show the hook's payload schema, pretty-printed
- Copies the full URL to the clipboard in one click
- Refetches on demand via a refresh button (circular-arrow icon, top right, which spins while a fetch is running — honouring `prefers-reduced-motion`)

## What It Doesn't Do (Yet)

This first iteration is read-only meaning that, while you can do the above things, the following features will only be added in a later version:

- Edit/update a webhook from here
- Add a new webhook from here
- Delete/remove a webhook from here

### Row layout

The two per-row actions are small icon buttons sitting **inline, immediately after the URL**, rather than in a column of their own:

| Icon                 | Action                                           |
| -------------------- | ------------------------------------------------ |
| eye / eye-with-slash | Reveal or re-mask the full URL                   |
| two offset squares   | Copy the full URL (briefly becomes a green tick) |

The panel's refresh control is icon-only too. It keeps the bordered button treatment, so `.awh-refresh` overrides the `.awh-icon` base — those rules sit _after_ `.awh-icon` in the stylesheet and match its specificity, winning on source order. Because the word "Refresh" is gone, `data-busy="true"` spins the glyph while a fetch is in flight; that attribute is set alongside the existing `disabled` in `setRefreshBusy()`.

They inherit the URL's colour via `color: inherit` on `.awh-url-row`, so they sit at the same visual weight as the text they belong to and shift with it when a row is revealed — grey (`--mantine-color-gray-7`) while masked, full text colour once revealed. The glyphs are 13px inside an 18px hit area, at 0.75 opacity until hovered.

That leaves the security badge alone on the right, so it gets a **Security** heading above the list — right-aligned with `padding-right: calc(1rem + 1px)` (the row padding plus the list's border) so it lines up exactly above the badges. It's rendered as part of the row list rather than the panel header, so it only appears when there are rows beneath it, and uses bold title case to match the flows-filter table header rather than the uppercase badges under it.

### URL masking

A hook URL is effectively the credential — anyone holding it can post into the hub — and Amplience's own library truncates it. So the tab shows a masked form by default:

```
https://api.amplience.net/hooks/…••••1a49
```

The eye icon shows the full URL and **re-masks it automatically after 30 seconds**, so a revealed URL doesn't sit on screen for the rest of a screen-share. The copy icon always copies the full URL and never puts it on screen, which is the path most people want.

Leaving the tab (clicking Flows/Runs/Reviews, navigating away, or disabling the module) re-masks every revealed row immediately.

## Scope

The flow listing page, including its one routed sub-tab:

- `https://app.amplience.net/content-studio/<hubId>/content-flows`
- `https://app.amplience.net/content-studio/<hubId>/content-flows/reviews`

Flow _detail_ pages carry no tab bar, so the module deliberately does nothing there.

`isFlowsListingPage()` uses an **allowlist** (`LISTING_SUBROUTES`) for what may follow `/content-flows`, rather than a path-length check. That matters because a flow detail URL is also one segment deeper — `…/content-flows/<flowId>` — so a length check would match every flow in the hub.

Verified against the live app: `/content-flows/reviews` renders the tab bar with Reviews active, while `/content-flows/runs` and `/content-flows/flows` render an empty page. Only `reviews` is a real route (see [Known core-product quirk](#known-core-product-quirk)).

## Deep linking

Activating the tab appends `#webhooks` to the URL, so the view is bookmarkable and shareable, and the browser's back button returns to the Flows tab. Loading a `…/content-flows#webhooks` URL opens straight onto the tab once the page has hydrated.

Amplience's router is path-based and ignores the hash, so this doesn't collide with anything in the core product. Clicking a native tab clears the hash with `history.replaceState`, so hash entries don't pile up in history.

## Known core-product quirk

Amplience's own tab switching is inconsistent, which is worth knowing before debugging anything tab-related here:

- `reviews` has a real route (`/content-flows/reviews`) and sets the initial tab on load.
- `runs` and `flows` have **no** route — navigating to them directly renders an empty page.
- Clicking any tab **never updates the URL**. Verified by starting on `/content-flows/reviews`, clicking Flows, then Runs, then Reviews: the path stayed `/reviews` throughout.

So the URL sets the initial tab but tab changes are never written back. Landing on `/reviews`, clicking Flows and refreshing throws you back to Reviews, and Runs can't be linked to at all.

This module is unaffected — it keys off its own `#webhooks` hash, which the app's router ignores.

The [style-patches](../style-patches/README.md) module now works around it, keeping the active tab in the URL (`#runs` for Runs, the real `/content-flows/reviews` route for Reviews, a bare path for Flows). **Both modules write to the URL of the same tab bar**, so two contracts keep them apart:

1. style-patches only acts on tabs carrying a `-tab-<value>` Mantine id, so it never touches this module's injected tab or overwrites `#webhooks`.
2. This module clears the hash from a **capture**-phase click listener; style-patches writes its URL from a **bubble**-phase one, so it runs afterwards and its URL wins.
3. style-patches treats any hash it doesn't own — `#webhooks` included — as "hands off", and suppresses its own tab restoring for the duration of a tab click. Both were needed: without them, activating this module's tab from the Reviews route was undone instantly, and leaving it took two clicks.

If you change the phase of `handleNativeTabClick` here, or make `deactivateView()` stop clearing the hash, re-read the guards in [style-patches](../style-patches/README.md#why-restore-has-two-guards--dont-remove-either) — they are written around this module's exact behaviour. Either module can still be toggled off independently.

## Implementation Details

### GraphQL query

```graphql
query getWebhooks($hubId: ID!) {
  cmsHub(id: $hubId) {
    webhookListeners {
      edges {
        node {
          id
          label
          schema
          security {
            __typename
          }
          url
        }
      }
    }
  }
}
```

`$hubId` is the URL path segment after `/content-studio/`, used verbatim (it's already the GraphQL global ID).

Notes on the response:

- `schema` comes back as a **JSON string**, not an object. It's `JSON.parse`d and re-stringified with 2-space indent for display, and shown verbatim if it doesn't parse. An empty schema (`{}`) disables the row's expander rather than showing an empty block.
- `security.__typename` is e.g. `WebhookListenerSecurityNone`. The badge strips the `WebhookListenerSecurity` prefix and splits camelCase, so that renders as `None`. **No secret is fetched** — the query asks only for the type name.

Results are cached in memory per hub for the session; **Refresh** clears the cache.

### Authentication

Reads the Auth0 JWT from `localStorage` under keys prefixed `@@auth0spajs@@`, the same approach as [flows-migration](../flows-migration/README.md). The helper is duplicated rather than shared so each module stays self-contained and a failure in one can't take the other down. If no token is found the panel shows "Not signed in - reload the page and try again."

No new manifest permissions are needed: `api.amplience.net` serves permissive CORS headers to `app.amplience.net`, so the content script's `fetch` works without a host permission entry.

### Selectors and their fallbacks

Amplience's Mantine class names are hashed and change between builds, so the module hangs off `data-testid` and ARIA roles, with the hashed class as a fallback. Every lookup is optional — if any of these disappear the module gives up quietly and the page behaves exactly as Amplience ships it.

| Target                 | Primary                                              | Fallback                    | If it disappears                                       |
| ---------------------- | ---------------------------------------------------- | --------------------------- | ------------------------------------------------------ |
| Tabs component         | `[data-testid="tabs"]`                               | `.mantine-Tabs-root`        | No tab is injected                                     |
| Tab list               | `[role="tablist"]`                                   | `.mantine-Tabs-list`        | No tab is injected                                     |
| Tab template           | `[role="tab"]` (first)                               | —                           | No tab is injected                                     |
| Native panels          | `.mantine-Tabs-panel`                                | —                           | Our panel renders below theirs instead of replacing it |
| Tab label / icon slots | `.mantine-Tabs-tabLabel`, `.mantine-Tabs-tabSection` | `textContent` on the button | Tab shows text without an icon                         |

**The injected tab is a `cloneNode` of a real one.** That's deliberate: the clone inherits Amplience's current hashed classes, so the tab keeps matching the genuine ones through restyles in a way hand-written markup wouldn't. Only the id, `aria-controls`, `data-testid`, label text and icon are swapped.

### How the panel swap works

Amplience keeps all three tab panels mounted and hides the inactive ones with an **inline** `display: none`, which React owns. The module never writes to those inline styles. Instead:

- `data-amplience-webhooks-view="active"` goes on `<html>` while our tab is showing
- `flows-webhooks.css` hides `.mantine-Tabs-panel` with `!important` under that attribute (an `!important` rule beats a non-important inline style)
- Removing the attribute hands the native panels straight back, untouched

This avoids the classic failure where you hide the active panel yourself and React never re-renders it (because its own tab value didn't change), leaving the user on a blank Flows tab.

Mantine paints the active tab from `data-active`. React doesn't know our tab exists, so while our view is active the module moves that flag off whichever native tab holds it — recording which one in `data-amplience-was-active` — and restores it on deactivate. Without this the page would show two active tabs, or none.

The native-tab click handler is registered in the **capture** phase so it runs before React's, meaning our panel is already out of the way by the time the clicked tab activates.

### SPA navigation

Amplience is a single-page app, so arriving at the flows list can mean any of: a real page load, a router `pushState`, a `popstate`, or a React remount with no URL change at all — and the tab bar renders some time _after_ whichever of those happened.

Rather than trying to catch every one of those mechanisms, the module is **declarative**. `syncUi()` asks one question — _should the tab be on the page right now, and is it?_ — and adds or removes it accordingly. Everything just calls `syncUi()`:

- A `MutationObserver` on `document.body`, which is the load-bearing one. This is what makes the module work when the user **navigates to the flows list client-side** instead of loading it directly: at that moment there is no tab bar to observe, and no guarantee the route change arrived through an event we hooked.
- `history.pushState` / `history.replaceState` interception, `popstate`, and `hashchange`. These are only a **fast path** — they get the tab up as soon as the URL changes rather than waiting for the next DOM mutation. If they never fire (a router that captured `history.pushState` before our content script ran, say), the observer still handles it.

There is deliberately **no retry budget and no timeout**. A tab bar that renders late, or a user who navigates to the flows list twenty minutes into a session, is handled the same way as one that renders immediately.

The observer callback is debounced by 150 ms and only schedules work when the page and the wanted state disagree (`isFlowsListingPage() !== tabIsPresent`), so it costs three cheap lookups per mutation batch. Measured across a full away-and-back navigation on a populated hub: 5 callbacks, 2 of which scheduled a sync.

**Note on `matches`.** The content script is scoped to `/content-studio/*`, which is sufficient because entering Workforce from the account switcher is a genuine page load — verified, not assumed. Client-side navigation _within_ Workforce is what the observer covers.

### Styling

Scoped entirely to `[data-amplience-flows-webhooks="enabled"]` on `<html>`, so turning the toggle off reverts the page immediately with no reload. Colours come from Mantine's own custom properties (`--mantine-color-text`, `--mantine-color-default-border`, `--mantine-color-gray-1`, …), so the panel follows Amplience's light/dark scheme and the theming module's per-hub colours without knowing anything about either.

The tab carries the **official webhook mark** — three nodes joined by arcs. The arc geometry is Tabler's `webhook` icon, on the same 24px grid as Amplience's own tab icons; the three filled circles at the arc centres (12,8), (7,17) and (17,17) are part of the official logo but absent from Tabler's outline version, so they're drawn in.

It's set at stroke-width 1.5 to match the weight of the Flows/Runs/Reviews icons rather than the logo's heavier lockup, and uses `stroke="currentColor"` rather than the hardcoded `#002C42` Amplience puts on its own tab icons, so it stays visible in dark mode.

All API data is written with `textContent` and `createElement` — never `innerHTML` — so a webhook label or schema can't inject markup. The only `innerHTML` write is the module's own static SVG.

## Troubleshooting

1. Confirm **Enable Flows Webhooks** is turned on (it's off by default).
2. Navigate to the flows list (`/content-studio/<hubId>/content-flows`) — not an individual flow.
3. Check DevTools > Sources > Content scripts and verify `flows-webhooks.js` is injected.
4. Check DevTools > Console for messages prefixed `[Amplience Helper] flows-webhooks:`.
5. If the tab doesn't appear:
   - Check whether the tab bar selectors in the table above still resolve.
   - Confirm the URL's last path segment is `content-flows` (`isFlowsListingPage()`).
   - There's no give-up timer, so a missing tab means either a selector miss or the observer not firing — check `document.body` is being observed.
6. If the list shows an auth error, reload the page to refresh the Auth0 token.
7. If the list is empty, confirm the hub actually has webhook URLs via the library inside any flow.
