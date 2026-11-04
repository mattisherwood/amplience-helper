[< Back](../../README.md)

# Flows Webhooks Module

Adds a **Webhooks** tab to the Workforce flows list, showing every webhook URL in the current hub. Works in both the classic app (`app.amplience.net`) and the new UI (`unifiedapp.amplience.net`, previously `nextgen.amplience.net`). Amplience only exposes these from the webhook library inside a flow edit screen, and truncates the URLs there, so getting a hook URL out of the platform normally means opening a flow you didn't want to edit.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Flows Webhooks**
- Extension options page: toggle **Enable Flows Webhooks**

The setting key is `flowsWebhooksEnabled` in `chrome.storage.sync`. It defaults to `false`.

## What It Does

- Classic app: injects a fourth tab, **Webhooks**, alongside Flows / Runs / Reviews on the flow listing page
- New UI: pins a **Webhooks** tab after Flows and Runs in the flows workbench, where it stays while a flow is open (see [New UI](#new-ui))
- New UI: adds a **Webhooks** link to Settings > Automation that opens that tab (see [Settings link](#settings-link))
- New UI: adds an **Open Webhooks tab** button under a Webhook Trigger's Webhook field in the flow editor (see [Webhook Trigger shortcut](#webhook-trigger-shortcut))
- Lists every webhook listener in the hub, sorted by label
- Shows each hook's security type as a badge (`None`, `Hmac`, …) under a **Security** column heading
- Expands each row to show the hook's payload schema, pretty-printed
- Copies the full URL to the clipboard in one click
- Refetches on demand via a refresh button (circular-arrow icon, top right, which spins while a fetch is running — honouring `prefers-reduced-motion`)
- Creates, edits and deletes webhook URLs in a dialog (see [Create, edit and delete](#create-edit-and-delete))

## Create, edit and delete

**Create webhook URL** (top right, next to refresh) and the **pencil** on each row open the same dialog, with the fields Amplience's own webhook library has:

| Field                 | Notes                                                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Label                 | Required.                                                                                                                                                                                                            |
| Enable authentication | Off by default, as in Amplience's form. Off shows a warning that anyone with the URL can trigger the flows using it.                                                                                                 |
| Secret                | Required when turning authentication on. **Generate** (32 random bytes as hex) is always there; show/hide and copy appear once the field has a value. When editing an HMAC hook it's blank and optional — see below. |
| Authentication header | Default `X-Hub-Signature-256`.                                                                                                                                                                                       |
| HMAC algorithm        | SHA1, SHA256 (default), SHA384, SHA512.                                                                                                                                                                              |
| Encoding              | HEX or BASE64 (default).                                                                                                                                                                                             |
| Schema                | Required JSON Schema, validated as a JSON object before saving. Monospace editor; Tab indents (Shift+Tab leaves the field); **Format JSON** pretty-prints.                                                           |

Editing only sends what changed. **Delete** (edit only) swaps the footer for a confirmation that names the hook and warns that flows it triggers will stop receiving requests.

The layout follows the new UI rather than the classic library's nested accordions: one white card with a scrolling body and fixed footer, the HMAC settings in a soft grouped card, Mantine-variable colours and the new UI's 36px / 8px-radius buttons. The same dialog appears in the classic app.

### Secrets

The API never returns an HMAC secret. So when editing an HMAC hook the secret field is blank with "Leave blank to keep the current secret", and the update leaves `secret` out of the input — which keeps the existing one. Verified on 2026-11-04 by changing a test hook's header and encoding without a secret and getting a 202 from a request signed with the original secret. Typing or generating a secret replaces it.

Secrets are never logged, and are dropped with the dialog when it closes.

### Signature format

Verified on 2026-11-04 against a throwaway hook (SHA256):

- With the header `X-Hub-Signature-256`, Amplience expects GitHub's format, `sha256=<signature>`, in either encoding. The bare signature gets a 401.
- With any other header, it expects the bare signature. `sha256=<signature>` gets a 401.

The header field's hint says so, since it isn't obvious from Amplience's own form.

### Not exposed

`digestPrefix` (optional on both create and update) isn't in Amplience's form, so it isn't in this one either. Updates never send it, so an existing prefix is preserved.

### Row layout

The two per-row actions are small icon buttons sitting **inline, immediately after the URL**, rather than in a column of their own:

| Icon                 | Action                                           |
| -------------------- | ------------------------------------------------ |
| eye / eye-with-slash | Reveal or re-mask the full URL                   |
| two offset squares   | Copy the full URL (briefly becomes a green tick) |

The panel's refresh control is icon-only too. It keeps the bordered button treatment, so `.awh-refresh` overrides the `.awh-icon` base — those rules sit _after_ `.awh-icon` in the stylesheet and match its specificity, winning on source order. Because the word "Refresh" is gone, `data-busy="true"` spins the glyph while a fetch is in flight; that attribute is set alongside the existing `disabled` in `setRefreshBusy()`.

They inherit the URL's colour via `color: inherit` on `.awh-url-row`, so they sit at the same visual weight as the text they belong to and shift with it when a row is revealed — grey (`--mantine-color-gray-7`) while masked, full text colour once revealed. The glyphs are 13px inside an 18px hit area, at 0.75 opacity until hovered.

The payload-schema expander (a CSS-drawn chevron) is the **last item in the row**, at the far right after the security badge, so the label, URL and an opened schema all start at the row's left edge. Being at the end of the row it behaves like an accordion chevron: pointing down when closed, up when open.

The security badge sits just left of it, under a **Security** heading above the list. The heading is right-aligned with `padding-right: calc(var(--awh-row-padding-x) + 1px + var(--awh-expand-size) + var(--awh-row-gap))` — the row padding, the list's border, then the expander and the gap before it — so it lines up exactly above the badges. Those three custom properties are set once on `.awh-body` and used by the rows too, so the heading can't drift if the row geometry changes. It's rendered as part of the row list rather than the panel header, so it only appears when there are rows beneath it, and uses bold title case to match the flows-filter table header rather than the uppercase badges under it.

### URL masking

A hook URL is effectively the credential — anyone holding it can post into the hub — and Amplience's own library truncates it. So the tab shows a masked form by default:

```
https://api.amplience.net/hooks/…••••1a49
```

The eye icon shows the full URL and **re-masks it automatically after 30 seconds**, so a revealed URL doesn't sit on screen for the rest of a screen-share. The copy icon always copies the full URL and never puts it on screen, which is the path most people want.

Leaving the tab (clicking Flows/Runs/Reviews, navigating away, or disabling the module) re-masks every revealed row immediately.

## Scope

In the new UI, every flows workbench route — see [New UI](#new-ui).

In the classic app, the flow listing page, including its one routed sub-tab:

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

### Files

| File                         | Loaded on          | Job                                                                                                                             |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `flows-webhooks.core.js`     | both               | GraphQL, hub ID lookup, URL masking, the whole panel. Exposes `globalThis.AmplienceFlowsWebhooks`                               |
| `flows-webhooks.dialog.js`   | both               | Create / edit / delete dialog. Adds `openEditor()` / `closeEditor()` to the core namespace                                      |
| `flows-webhooks.js`          | classic            | Tab injection, routing and panel swap for `/content-studio/<hubId>/content-flows`                                               |
| `flows-webhooks.nextgen.js`  | new UI             | The same for the `/:org/flows/:hub` workbench                                                                                   |
| `flows-webhooks.css`         | both               | Panel and list styles, plus the classic panel swap                                                                              |
| `flows-webhooks.bridge.js`   | new UI, page world | Asks the app to refetch its own webhook list (see [Keeping the flow editor's list fresh](#keeping-the-flow-editors-list-fresh)) |
| `flows-webhooks.nextgen.css` | new UI             | Page-header layout and a second, structural panel-swap rule                                                                     |

Same split as [flows-migration](../flows-migration/README.md): the core never touches the page beyond the panel element it builds, so once the classic app is retired `flows-webhooks.js` can be deleted on its own.

Load order is core → dialog → host. The panel only shows its create and edit buttons if `openEditor` exists when it's built, so if the dialog file fails to load the panel quietly stays read-only.

`createPanel()` builds the panel once and returns `{ element, load(force), remask(), resetCache() }`. Hosts re-attach the same `element` whenever React drops it, so the fetched list and any expanded schema survive a re-render. `load()` takes the hub ID from a `getHubId()` the host passes in — read straight from the URL in the classic app, looked up by name in the new UI.

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
            ... on WebhookListenerSecurityHMAC {
              header
              algorithm
              encoding
            }
          }
          url
        }
      }
    }
  }
}
```

`$hubId` is the URL path segment after `/content-studio/` in the classic app, used verbatim (it's already the GraphQL global ID). The new UI has the hub _name_ in the URL, so the ID is looked up once per org/hub with `viewer.organizations(first: 100) { … cmsHubs { id name } }` and cached — the same query as flows-migration's `resolveCmsHubId`.

Notes on the response:

- `schema` comes back as a **JSON string**, not an object. It's `JSON.parse`d and re-stringified with 2-space indent for display, and shown verbatim if it doesn't parse. An empty schema (`{}`) disables the row's expander rather than showing an empty block.
- `security.__typename` is e.g. `WebhookListenerSecurityNone`. The badge strips the `WebhookListenerSecurity` prefix and splits camelCase, so that renders as `None`. For HMAC hooks the query also fetches `header`, `algorithm` and `encoding` to prefill the edit dialog. **No secret is fetched** — the API doesn't return one.

### Mutations

Checked by introspection on 2026-11-04:

```graphql
createWebhookListener(input: { cmsHubId, label, schema, security }): WebhookListener!
updateWebhookListener(input: { id, label?, schema?, security? }): WebhookListener!
deleteWebhookListener(input: { id }): Boolean!
```

`security` is one of `{ hmac: { secret, header, algorithm, encoding, digestPrefix? } }` or `{ none: { dangerouslyAllowUnauthenticated: true } }`. On update every `hmac` field is optional. These run as the signed-in user with their own permissions — the same calls Amplience's webhook library makes. Create, update (label and schema; None→HMAC; header and encoding without a secret; HMAC→None) and delete were all run against a throwaway hook on Quadratic Lite, which was then deleted.

Results are cached in memory per hub for the session; **Refresh** clears the cache. If the user moves hub while a fetch is in flight, its result is discarded and the new hub is loaded.

### Authentication

Reads the Auth0 JWT from `localStorage` under keys prefixed `@@auth0spajs@@`, the same approach as [flows-migration](../flows-migration/README.md). The helper is duplicated rather than shared so each module stays self-contained and a failure in one can't take the other down.

A browser can hold several cached entries, and the first isn't necessarily usable: on 2026-11-04 a classic-app profile had an expired `openid profile email offline_access` entry ahead of the live `openid profile email` one, and the expired token got `Missing permission read on Hub …` back (a 200 with a GraphQL error, not a 401). So the helper skips entries whose `expiresAt` has passed, prefers the `api.amplience.net` audience, then takes whichever expires last. An entry with no `expiresAt` counts as live. If no token is found the panel shows "Not signed in - reload the page and try again."

No new manifest permissions are needed: `api.amplience.net` serves permissive CORS headers to `app.amplience.net` and the new UI's origins, so the content script's `fetch` works without a host permission entry.

### Selectors and their fallbacks (classic)

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

## New UI

Verified against `unifiedapp.amplience.net` on 2026-11-04.

### How the workbench differs

- **It's a workbench, not a page tab bar.** The tab list sits in the global app header: pinned "library" tabs (Flows, Runs) followed by a closeable tab per open flow. The pinned tabs stay while a flow is open, so Webhooks is reachable from inside the flow editor — the classic app has no tab bar there.
- **Every native tab is a route** — `/flows/:hub`, `/flows/:hub/runs`, `/flows/:hub/:flowId`. Anything else after the hub is taken as a flow ID: `/flows/:hub/webhooks` opens a broken "Flow" tab ("This flow could not be loaded."). So this tab has no path of its own; it's driven by `#webhooks` on whichever workbench route is current, including a flow's.
- **Tabs and panels live apart.** The tab list is portalled into the header, outside the Tabs root that holds the panels, so each is found separately.
- **Inactive panels are emptied** as well as hidden. Our panel only ever hides the active one with CSS, so an open flow editor stays mounted — unsaved changes and all — while Webhooks is showing.
- `/flows/:hub/settings/*` has no workbench, so the tab and panel are removed there.

### Selectors and their fallbacks

Mantine builds ids as `mantine-<uid>-tab-<value>` / `mantine-<uid>-panel-<value>`, where `<value>` is the app's own tab key, so those are far steadier than the hashed CSS-module classes on the same elements. If any of these stop matching, the tab doesn't appear and the page behaves as Amplience ships it.

| Target                 | Selector                                                               | If it disappears                    |
| ---------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| Workbench tab list     | `[id$="-tab-flows-library"]` → closest `[role="tablist"]`              | No tab is injected                  |
| Template tab           | `[id$="-tab-flow-runs-library"]`, else the Flows tab                   | No tab is injected                  |
| Panels root            | parent of `[id$="-panel-flows-library"]`                               | No tab is injected                  |
| Tab label              | `[data-label]` attribute + the text node matching the template's label | Tab shows text without an icon      |
| Tab icon               | the template's first `svg`                                             | Tab shows the label only            |
| Flow-tab close buttons | `.mantine-CloseButton-root`, `[aria-label^="Close "]`                  | Closing a flow also leaves Webhooks |

The tab is placed **structurally**: the cloned unit is the template's outermost ancestor that holds no other tab (today an animated wrapper div), and it goes into the parent that does (the pinned-tabs group). No hashed `_tabWrapper` / `_pinnedTabs` class is referenced.

### URL and history

- Our tab adds `#webhooks` with `history.pushState(history.state, …)`. A `location.hash =` assignment would fire `popstate`, which React Router handles as a navigation of its own and records without its index state; passing the router's current state object leaves it undisturbed.
- The URL is the source of truth. `syncUi()` shows Webhooks whenever the current workbench route carries `#webhooks`, and hides it otherwise — so Back, Forward, deep links and a route change that drops the hash all just work.
- **Clicking another route's tab** (Runs from Flows, say): React pushes that route, the `#webhooks` entry stays in history, and **Back returns to Webhooks** — an improvement on the classic tab. While React is navigating away, `leavingFrom` stops the sync from bringing the view straight back.
- **Clicking the tab of the route you're already on** (it carries `data-amplience-was-active`): the app does nothing, since that tab is already its current value, so the host drops the hash itself with `replaceState`.
- **Closing a flow tab** isn't treated as leaving Webhooks. If it was the flow whose route you're on, React navigates elsewhere, the hash goes with it, and the sync hides the panel.

### Panel swap

Same approach as the classic host — `data-amplience-webhooks-view="active"` on `<html>` hides the native panels with an `!important` rule, and `data-active` / `aria-selected` are moved off the native tab and restored afterwards. React rewrites those when its active tab changes (a route change while Webhooks is showing), so the sync re-applies them, and the was-active marker always follows React's latest active tab.

`flows-webhooks.nextgen.css` adds a second hide rule keyed on wherever the panel was actually appended (`*:has(> #flows-webhooks-panel) > [role="tabpanel"]`), so the native and injected panels can't both show even if `data-testid="tabs"` goes away.

The panel header is measured against the native Flows page header (20px padding, 21px / 600 title) and uses Mantine variables throughout.

### Settings link

The Settings side nav gets a **Webhooks** link under Automation, after AI models and Skills. It deliberately isn't a settings page: it links to `/:org/flows/:hub#webhooks`, which opens the Flows workbench on the Webhooks tab, so the tab stays the one place the list lives. (The Content group's own "Webhooks" link is Amplience's placeholder for content webhooks — an external link to the classic app — and is a different thing.)

- **Finding the group:** by href, not by the "Automation" heading or hashed `_link_*` classes — `a[href*="/flows/"][href$="/settings/ai-models"]` and `…/settings/skills`. Those links appear on the flows, content and assets settings pages (all pointing at the same flows hub), so the link appears on all three. Org-level settings (`/:org/settings/*`) has no Automation group, so no link.
- **The href** is the template's with `/settings/<page>` swapped for `#webhooks`, so it always targets the hub the native links do.
- **Cloning:** a non-active link is preferred as the template. The active one carries `aria-current`, a hashed `_linkActive_*` class and a highlight element with `view-transition-name: side-nav-highlight-settings`, which must stay unique on the page — so the clone strips all three regardless. `data-discover` (React Router's lazy-route marker) is dropped too. The icon's paths are swapped inside the existing `svg`, keeping the side nav's CSS-variable sizing.
- **Navigation:** the clone has no React Router handler, so a plain click does what the router does on Back — `pushState` to the URL, then dispatch `popstate` — and the router renders the flows route without a reload. Our sync then sees `#webhooks` and opens the tab. Back returns to the settings page. If the workbench hasn't rendered 3 s later (the router stopped listening that way), the page is reloaded at the new URL instead. Cmd/Ctrl/Shift/middle-clicks are left to the browser, so "open in new tab" works.

| Target           | Selector                                                                | If it disappears |
| ---------------- | ----------------------------------------------------------------------- | ---------------- |
| Automation links | `a[href*="/flows/"][href$="/settings/ai-models" \| "/settings/skills"]` | No link is added |

### Webhook Trigger shortcut

The classic flow editor has an "Open Webhook Library" button under the Webhook Trigger's **Webhook** field; the new UI dropped it. This puts an **Open Webhooks tab** button in the same place. It's only a shortcut: it calls the same `showWebhooks()` as the tab, so `#webhooks` is pushed onto the flow's own route, the flow stays open (and mounted, unsaved changes included) in the workbench, and Back — or clicking the flow's tab — returns to it.

It also flashes the hook the field has selected, via `panel.highlight(id)` in the core (immediately if the list is already showing, otherwise when it renders).

- **Finding the field:** the action's config form is generated from its JSON schema, and each input carries a `schemalocation` attribute pointing at its property. The Webhook select's ends `/properties/amp:webhookId`, which is matched instead of the label or hashed classes. The button goes straight after the field's `.mantine-InputWrapper-root`. That makes it an item in the form's SimpleGrid, so it gets the form's own 16px gap; `justify-self: start` keeps it button-width.
- **The selected hook:** Mantine's Select keeps the value in a hidden input beside the field. Listener IDs are GraphQL global IDs starting `V2ViaG9va0xpc3RlbmVy` (base64 for `WebhookListener`), which is how that input is picked out. If it isn't found, the tab still opens, just without the highlight.
- **Re-renders:** the button and field point at each other (`awhField` / `awhShortcut` expandos, visible only to the content script). The sync removes buttons whose field has gone and adds one to any field without a live button, so a re-rendered form never ends up with zero or two.

| Target        | Selector                                                                                    | If it disappears                |
| ------------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| Webhook field | `input[schemalocation$="/properties/amp:webhookId"]` → closest `.mantine-InputWrapper-root` | No button                       |
| Selected hook | sibling `input[type="hidden"]` whose value starts `V2ViaG9va0xpc3RlbmVy`                    | Tab opens without the highlight |

### Keeping the flow editor's list fresh

The Webhook Trigger's dropdown only ever fetched its list on page load. A hook created or renamed on the Webhooks tab (or anywhere else) didn't show up there until a full refresh. That was true before this module too.

**Why** (verified 2026-11-04, from the app's bundle): the list comes from an RTK Query endpoint, `getWebhookListeners`, on the app's `graphQLApi` slice. That API is created with `refetchOnFocus: false` and no polling, and opening the pane or the dropdown makes no request. The endpoint provides the `WebhookListeners` tag, though, and invalidating a tag makes RTK Query refetch every mounted query that uses it. Two queries are mounted while a flow is open; both refetch, and the dropdown re-renders with the new list. The selected hook stays selected and the flow isn't marked as changed. All three were checked by feeding the app a doctored response containing an extra hook, which appeared in the dropdown with no server writes.

**How:** the app's Redux store isn't reachable from the extension's isolated world, so `flows-webhooks.bridge.js` runs in the page's own world (`"world": "MAIN"` in the manifest — no extra permission). It listens for a DOM event, `amplience-helper:refresh-webhook-listeners`, finds the store and dispatches `{ type: "graphQLApi/invalidateTags", payload: ["WebhookListeners"] }` — the action `api.util.invalidateTags` creates. The store is found by walking React's fiber tree from `#root` (`__reactContainer$…`) to the first fiber whose props hold a store containing `graphQLApi` (react-redux's `<Provider>`, three fibers down), and is then cached. The event carries no data and the bridge returns none, so a page script firing it can do no more than cause a refetch.

`flows-webhooks.nextgen.js` fires the event:

- straight after a create, edit or delete on the Webhooks tab (forced)
- when a Webhook Trigger's config pane opens, i.e. when its field appears
- when the dropdown is focused, i.e. about to open — a fallback for a pane that's been open a while; a refetch landing while it's open updates the options in place

RTK Query keeps serving the cached list while a refetch is in flight and swaps the new one in when it lands. Refreshing as the pane opens therefore usually has the list fresh before the dropdown is opened, rather than having options shift under the cursor. The passive triggers are throttled to one per 2 s. If the store or slice can't be found, nothing happens and the dropdown behaves as Amplience ships it.

| Assumption                            | Where                 | If it changes                             |
| ------------------------------------- | --------------------- | ----------------------------------------- |
| RTK Query `reducerPath: "graphQLApi"` | bridge `REDUCER_PATH` | Store not matched — no refresh            |
| Tag type `WebhookListeners`           | bridge `TAG`          | Invalidation matches nothing — no refresh |
| React root on `#root`                 | bridge `findStore`    | Store not found — no refresh              |

## Troubleshooting

1. Confirm **Enable Flows Webhooks** is turned on (it's off by default).
2. Classic: navigate to the flows list (`/content-studio/<hubId>/content-flows`) — not an individual flow. New UI: any `/:org/flows/:hub` route except settings.
3. Check DevTools > Sources > Content scripts and verify `flows-webhooks.core.js` is injected, followed by `flows-webhooks.js` (classic) or `flows-webhooks.nextgen.js` (new UI). A `flows-webhooks.core.js not loaded` console error means the manifest order is wrong.
4. Check DevTools > Console for messages prefixed `[Amplience Helper] flows-webhooks:`.
5. If the tab doesn't appear:
   - Check whether the tab bar selectors in the table above still resolve.
   - Classic: confirm the URL's last path segment is `content-flows` (`isFlowsListingPage()`).
   - New UI: check `[id$="-tab-flows-library"]` and `[id$="-panel-flows-library"]` still resolve.
   - There's no give-up timer, so a missing tab means either a selector miss or the observer not firing — check `document.body` is being observed.
6. If the list shows an auth error, reload the page to refresh the Auth0 token. `Missing permission read on Hub …` for a hub you can open usually means a stale token was picked — check the `@@auth0spajs@@` entries' `expiresAt`.
7. If the list is empty, confirm the hub actually has webhook URLs via the library inside any flow.
