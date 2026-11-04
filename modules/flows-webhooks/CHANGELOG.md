# Flows Webhooks Changelog

## 2026-11-04 (extension v2.6.0)

### Added

- Create, edit and delete webhook URLs. **Create webhook URL** in the panel header and a pencil on each row open a dialog (`flows-webhooks.dialog.js`, a native `<dialog>`) with Amplience's own fields: label, enable authentication, HMAC secret / header / algorithm / encoding, and the payload schema. It works in both UIs.
- Secret field with show/hide, copy and generate. Show/hide and copy only appear once the field has a value, as in the classic form, and emptying it re-masks it. Editing an HMAC hook leaves the secret blank, and saving without one keeps the existing secret.
- Schema validated as a JSON object before saving, with a Format JSON button and Tab-to-indent.
- Delete with an inline confirmation that names the hook.
- The row that was just created or edited flashes briefly once the list refreshes.
- `createWebhook`, `updateWebhook` and `deleteWebhook` in the core, plus `iconSvg` and `copyToClipboard` exported for the dialog.

### Changed

- The list query also fetches `header`, `algorithm` and `encoding` for HMAC hooks, to prefill the edit form.
- With editing available, the "Security" heading moves left by one more button and gap (`.awh-body[data-editable="true"]`).
- The empty-hub message points at the Create button rather than the flow editor's library.

### Notes

- Edits send only the fields that changed. The `secret` is left out unless one was typed or generated.
- The dialog stops keydown propagation, so the Hotkeys module (which listens on `document`) can't act behind it — e.g. W closing a workbench tab while the auth switch has focus.
- Verified on a throwaway hook: with the header `X-Hub-Signature-256` Amplience expects `sha256=<signature>`; with any other header, the bare signature. The header hint says so.
- `digestPrefix` isn't in Amplience's form, so it isn't exposed; updates never touch it.

## 2026-11-04 (extension v2.5.6)

### Added

- New UI support (`nextgen.amplience.net` and `unifiedapp.amplience.net`) via `flows-webhooks.nextgen.js` + `flows-webhooks.nextgen.css`. A **Webhooks** tab is pinned after Flows and Runs in the flows workbench, and stays there while a flow is open.
- The new UI's panel has a page-style header (title, count, refresh) matching the native Flows/Runs pages.
- New UI: a **Webhooks** link in the Settings side nav, under Automation after AI models and Skills. It's a link to `/:org/flows/:hub#webhooks`, not a settings page — the tab stays the one place the list lives. Navigates in-app (pushState + popstate), with a full page load as fallback.

### Changed

- The payload-schema expander moved from the start of each row to the end (far right, after the security badge), and now points down/up like an accordion. The "Security" heading is offset by the expander's width plus the row gap, via shared `--awh-*` custom properties on `.awh-body`. The opened schema now aligns with the row's left padding instead of being indented past the old expander.
- Split into a shared core and two hosts, like flows-migration. `flows-webhooks.core.js` holds the GraphQL calls, hub ID lookup, URL masking and the whole panel; `flows-webhooks.js` (classic) and `flows-webhooks.nextgen.js` (new UI) only decide where the tab and panel go and when the panel shows. `flows-webhooks.css` is shared; the new UI also loads `flows-webhooks.nextgen.css` for layout.
- The panel is now one element kept for the life of the page, re-attached when React re-renders rather than rebuilt. An expanded schema survives leaving and returning to the tab, and the list is only re-rendered when the hub changes or on refresh.
- The cache is keyed by hub ID inside the core, so the classic host no longer tracks `lastHubId` itself. A fetch that lands after the user has moved hub is discarded and the new hub is loaded.

### Fixed

- Token selection: the Auth0 helper took the first cached token it found. A profile holding an expired `offline_access` entry ahead of the live one got `Missing permission read on Hub …` from the API (verified 2026-11-04 on the classic app). It now skips expired entries, prefers the `api.amplience.net` audience, and takes the one that expires last.

### Notes

- New UI tabs are routes (`/flows/:hub`, `/runs`, `/:flowId`) and anything unknown after the hub is read as a flow ID, so the tab can't have a path of its own. It's driven by `#webhooks` on whichever workbench route is current.
- The hash is added with `history.pushState(history.state, …)` rather than `location.hash =`, which would fire a popstate React Router handles as a navigation.
- Clicking another route's tab leaves the `#webhooks` entry in history (Back returns to Webhooks). Clicking the tab of the route you're already on does nothing in the app, so the host drops the hash itself.
- In the new UI the hub is a name in the URL, so the GraphQL hub ID is looked up from `viewer.organizations` once per org/hub and cached.

## 2026-09-03 (extension v2.5.0)

### Added

- New module. Adds a **Webhooks** tab to the Workforce flows list showing every webhook URL in the hub, fetched with the `webhookListeners` GraphQL query on `cmsHub`.
- Security type badge per hook, from `security.__typename` with the `WebhookListenerSecurity` prefix stripped. Only the type name is fetched — no secret.
- Expandable payload schema per hook, pretty-printed. `schema` arrives as a JSON string; unparseable values are shown verbatim and empty ones disable the expander.
- Copy-to-clipboard per hook, with a textarea fallback for contexts where the Clipboard API is blocked.
- Reveal and copy are small icon buttons inline after the URL, inheriting its colour, leaving the security badge alone on the right under a **Security** column heading.
- Refresh is icon-only (circular arrow) and spins while fetching, since there's no longer a word to convey that it's working.
- URLs are masked by default and re-mask 30 s after being revealed, so a hook URL — effectively a credential — doesn't linger on screen during a screen-share.
- `#webhooks` hash makes the tab deep-linkable and back-button friendly.

### Notes

- Injection is **declarative**, not event-driven: `syncUi()` reconciles "should the tab be here, and is it?" and every trigger routes through it. A `MutationObserver` on `document.body` is the load-bearing trigger — it's what makes the tab appear when the user navigates to the flows list client-side, where there's no tab bar to observe yet and no guarantee the route change came through an event we hooked. The History API hooks are only a fast path. There is no retry budget or timeout as a result.
- The tab button is a `cloneNode` of a real Mantine tab, so it inherits Amplience's hashed classes and survives restyles.
- Native panels are hidden with an `!important` CSS rule under `data-amplience-webhooks-view="active"` rather than by writing to the inline styles React owns — otherwise clicking back to an already-"active" Flows tab wouldn't re-render it and the user would land on a blank panel.
- The Auth0 token helper is duplicated from flows-migration rather than shared, keeping each module self-contained.
- No new manifest permissions: `api.amplience.net` already serves CORS headers to `app.amplience.net`.
