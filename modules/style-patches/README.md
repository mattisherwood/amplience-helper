[< Back](../../README.md)

# Style Patches Module

Applies responsive and readability CSS improvements to Amplience pages.

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Styles Patch**
- Extension options page: toggle **Enable Styles Patch**

The setting key is `stylesEnabled` in `chrome.storage.sync`.

## What It Does

Despite the name, this module now covers UI patches generally, not only CSS:

- Applies CSS improvements only when enabled, scoped by a data attribute on `<html>` (`data-amplience-style-patches="enabled"`) so disabling instantly reverts to the native Amplience UI
- Adds a **Workforce** entry to the app switcher ("switcheroo") where the core product omits it
- Keeps the **flow tab** in step with the URL, so a refresh doesn't throw you onto a different tab (see below)

### Flow tab URL persistence

Amplience's flow tab bar is inconsistently routed. Verified against the live app:

- `reviews` has a real route (`/content-flows/reviews`) and sets the initial tab on load
- `runs` and `flows` have **no** route — navigating to them directly renders an empty page
- Clicking any tab **never updates the URL**

So the URL sets the initial tab but never follows it. Land on `/content-flows/reviews`, click Flows, refresh, and you're back on Reviews; and Runs can't be linked to at all.

This patch keeps the two in step:

| Tab | URL |
| --- | --- |
| Flows | `/content-flows` (bare — the app's own default tab) |
| Runs | `/content-flows#runs` (no route exists, so a hash) |
| Reviews | `/content-flows/reviews` (the app's own route) |

The hybrid is deliberate: `reviews` uses the real route because it works and is what the product intends, while `runs` can only use a hash because pushing `/content-flows/runs` would give a blank page on refresh.

Restoring works by **clicking Amplience's own tab** rather than reaching into React state, so if the core team reworks tab switching the click still runs whatever the new implementation does.

#### Why restore has two guards — don't remove either

`restoreTabFromUrl()` runs from the body observer, and a `MutationObserver` callback is a **microtask**. On a real user click, React commits the tab switch and that callback fires *before* the click event finishes bubbling to this module's own listener — measured on the live app at ~200ms ahead of it. A naive restore therefore reads the URL of the tab the user just **left** and clicks straight back to it: the content snaps back while the URL moves on, and the user has to click twice.

Two guards remove that race rather than papering over the timing:

1. **`reconciledUrl`** — each URL is restored at most once. `rememberTabInUrl()` marks the URL it writes as reconciled, so a stale URL can never pull the user backwards.
2. **`tabClickInFlight`** — restore is suppressed from the moment a tab click is seen (capture phase) until the URL for it has been written (bubble phase). This is needed *in addition* to the first guard because flows-webhooks clears its `#webhooks` hash from its own capture-phase listener, which mints a URL nobody has reconciled yet in the middle of the click. `beginTabClick()` also arms a 1s backstop timer, so if the bubble handler never runs — another listener stopped propagation — restore is not suppressed for good.

Because of guard 1, a restore won't re-run if Amplience remounts the tab bar and resets the tab while the URL still names another one. That's deliberate: the alternative is fighting the app.

URL updates use `replaceState`, not `pushState`: a refresh keeps your tab, but the back button skips past tab switches instead of trapping the user in them. Amplience's router doesn't listen for raw History API calls, so this corrects the URL without provoking a re-render.

#### Interaction with flows-webhooks — read before changing either

[flows-webhooks](../flows-webhooks/README.md) injects a fourth tab into the same tab bar and owns the `#webhooks` hash. Two contracts keep them out of each other's way:

1. **This module only touches Amplience's own three tabs.** It identifies them by their `-tab-<value>` Mantine id suffix, so the injected `flows-webhooks-tab` is ignored and its hash is never overwritten.
2. **This module's URL write is registered in the BUBBLE phase, deliberately.** flows-webhooks clears the hash from a *capture*-phase listener on the same clicks. A capture-phase write here could run first and have its hash wiped immediately afterwards; bubbling puts this one last, so the URL it writes wins. This module *also* has a capture-phase listener, but it only raises the `tabClickInFlight` flag — it never writes the URL.
3. **A hash this module doesn't own means hands off.** `flowTabFromUrl()` checks the hash *before* the path and returns null for any hash other than `#runs`. Without that, `/content-flows/reviews#webhooks` let the path win, so activating the Webhooks tab from the Reviews tab was instantly undone.

Either module can be toggled off independently without breaking the other.

## Files

- `style-patches.js`: Settings, the gating data attribute, the switcheroo Workforce link, and flow tab URL persistence
- `style-patches.home.css` / `.account.css` / `.dc.css` / `.dam.css` / `.wf.css`: Style overrides split by product area, loaded per-area from the manifest

## Development Notes

1. Add or update rules in the CSS file for the relevant product area.
2. Keep selectors scoped to `[data-amplience-style-patches="enabled"]`.
3. Reload extension and refresh Amplience pages to test changes.

## Troubleshooting

1. Confirm **Enable Styles Patch** is turned on.
2. Inspect `<html>` and verify `data-amplience-style-patches="enabled"` is present.
3. Check DevTools > Sources > Content scripts to ensure `style-patches.js` is injected.
