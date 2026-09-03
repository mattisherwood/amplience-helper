# Flows Webhooks Changelog

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

### Fixed

- The tab now also loads on `/content-flows/reviews`, Amplience's one routed sub-tab. `isFlowsListingPage()` was requiring `content-flows` to be the final path segment, so landing on the Reviews tab skipped injection entirely. It now uses an allowlist of sub-routes (`LISTING_SUBROUTES`) rather than a path-length check — a length check would also match `/content-flows/<flowId>`, i.e. every flow detail page, which has no tab bar.

### Notes

- Injection is **declarative**, not event-driven: `syncUi()` reconciles "should the tab be here, and is it?" and every trigger routes through it. A `MutationObserver` on `document.body` is the load-bearing trigger — it's what makes the tab appear when the user navigates to the flows list client-side, where there's no tab bar to observe yet and no guarantee the route change came through an event we hooked. The History API hooks are only a fast path. There is no retry budget or timeout as a result.
- The tab button is a `cloneNode` of a real Mantine tab, so it inherits Amplience's hashed classes and survives restyles.
- Native panels are hidden with an `!important` CSS rule under `data-amplience-webhooks-view="active"` rather than by writing to the inline styles React owns — otherwise clicking back to an already-"active" Flows tab wouldn't re-render it and the user would land on a blank panel.
- The Auth0 token helper is duplicated from flows-migration rather than shared, keeping each module self-contained.
- No new manifest permissions: `api.amplience.net` already serves CORS headers to `app.amplience.net`.
