# CLAUDE.md

Context for Claude working in this repo. Read this first.

## What this is

**Amplience Helper** is a Manifest V3 Chrome extension (live on the [Chrome Web Store](https://chromewebstore.google.com/detail/amplience-helper/pgkkeoeeecldakiakjbgddmlanlokeef), source on [GitHub](https://github.com/mattisherwood/amplience-helper)) that layers progressive enhancements on top of Amplience's Dynamic Content, Content Hub, and Workforce web apps. It exists because the core CMS rightly prioritises stability and roadmap commitments, so small UI improvements don't always fit the release cadence — and field/dashboard extensions only reach parts of the GUI. This extension is a complementary surface where low-risk enhancements can ship quickly, without competing for core-product engineering time.

### Progressive Enhancements

If a module fails or is disabled, it falls back to the default Amplience behaviour, and modules can be disabled individually from the popup. Low risk, high velocity.

## Why users want it

The extension addresses day-to-day pain points such as:

- The Amplience UI is often not responsive across screen sizes
- It's easy for a user to lose track of what they are editing where, especially when several identical-looking tabs are open
- Long lists of Workforce content flows can be hard to manage; hence the added flow-filters, archiving and tagging
- Many flows require lots of clicking; keyboard shortcuts cut that
- Visual sameness across hubs makes mistakes easy, so hub-specific GUI theming helps with that.

So the current modules are themed-hubs, smarter favicons/titles, flow filters, hotkeys, and CSS patches.

And the deployment mechanism is nimble, so other changes can be easily implemented to address other user pains identified in the future.

## Architecture at a glance

Vanilla JS, no build step, no `package.json`, no `node_modules`. The manifest loads each module's content scripts directly. Static-file simplicity is a feature.

```
amplience-helper/
├── manifest.json          # MV3 config — content scripts, host permissions, web-accessible resources
├── popup.html / popup.js  # Toolbar popup with module toggles
├── options.html / options.js  # Full options page
├── icons/                 # Extension icons (16/32/96/128)
├── modules/
│   ├── favicon-swapper/   # Per-area tab favicon + context-aware title prefix
│   ├── flows-filter/      # Workforce content-flow search/filter UI
│   ├── hotkeys/           # Keyboard shortcuts + ? help overlay
│   ├── style-patches/     # Responsive/readability CSS overrides
│   └── theming/           # Per-hub colour + dark mode
├── CHANGELOG.md           # User-focused, top-level
├── CHANGELOG-templates.md # Release templates + release checklist
└── README.md              # User & contributor docs
```

Each module folder is self-contained and ships its own `README.md` and `CHANGELOG.md`.

## Conventions — read before changing code

**Settings.** All toggles and per-module data live in `chrome.storage.sync`. Keys observed in the codebase:

- `stylesEnabled` (Style Patches)
- `flowFilter` (Flows Filter)
- `hotkeysEnabled` (Hotkeys)
- `themingEnabled` + `themingHubs` (Theming, per-hub object)
- `faviconSwapperEnabled` (Favicon & Title Updater)

**Style scoping pattern.** CSS-injecting modules gate their styles on a `data-amplience-*="enabled"` attribute on `<html>`, set/cleared by the module's JS in response to its toggle. Examples: `data-amplience-style-patches="enabled"`, `data-amplience-theming="enabled"`. Every CSS rule must be scoped to its attribute so disabling instantly reverts. Don't write unscoped CSS.

**Lifecycle.** Modules must react to their own toggle changing without a page reload — `chrome.storage.onChanged` listener, then start/stop their effects. The favicon swapper is the cleanest reference for this (it also handles SPA navigation via `pushState`/`replaceState`/`popstate` and DOM mutation observers, since Amplience is an Angular SPA).

**SPA awareness.** Amplience's main GUI is an Angular SPA with hydration delays. New modules that rely on DOM elements should:

1. Poll for the target with a sensible cap (favicon-swapper polls ~7 s).
2. Observe mutations to catch late-rendered panels.
3. Hook SPA navigation events so behaviour stays correct after route changes without a full reload.

**Toggle UI.** Any new module needs entries in both `popup.html`/`popup.js` and `options.html`/`options.js`. Match the wording in both places exactly — the release checklist explicitly checks this.

**Manifest scoping.** Be tight with `matches` patterns. Only run scripts on the URLs they need. Currently:

- Favicon swapper: `app.amplience.net/*` and `support.amplience.com/*`
- Flows filter: `app.amplience.net/content-studio/*`
- Hotkeys, theming: `app.amplience.net/content*`
- Style patches: `app.amplience.net/*`

**Permissions.** Only `storage` is requested. If a new module needs more, push back hard before adding — the privacy story matters and the Chrome Web Store review will scrutinise it.

## Adding a new module

1. Create `modules/<name>/` with `<name>.js`, `<name>.css` (if needed), `README.md`, and a CHANGELOG section in the README.
2. Pick a `chrome.storage.sync` key (e.g. `<name>Enabled`). Default to `false` until you're confident.
3. Wire content scripts into `manifest.json` with the narrowest `matches` pattern that works.
4. Add a toggle row to `popup.html` + `popup.js` and `options.html` + `options.js`. Wording must match.
5. Make the module respond to its toggle changing live, and gate CSS on a `data-amplience-<name>="enabled"` attribute if it injects styles.
6. Bump `manifest.json` version. Add module changelog entry, then summary line in root `CHANGELOG.md` (templates in `CHANGELOG-templates.md`).
7. Smoke-test the release checklist in `CHANGELOG-templates.md`.

## Releases

Distribution is via the Chrome Web Store (auto-updates) plus manual Load-unpacked for developers. There's no CI; releases are manual:

1. Update module changelogs first, then root summary.
2. Bump `manifest.json` `version` (semver-ish — see `CHANGELOG.md` history).
3. Reload the unpacked extension and run the smoke tests in `CHANGELOG-templates.md`.
4. Zip and upload to the Chrome Web Store listing.

When in doubt, default to a patch bump and explicitly call out user-visible changes in root `CHANGELOG.md`.

## How Claude should work here

- **Read first, edit second.** This codebase is small enough to understand fully — don't guess at conventions.
- **Stay vanilla.** No frameworks, no bundlers, no TypeScript — that's a deliberate constraint to keep the extension auditable and zero-dep.
- **Match the existing patterns** — data-attribute scoping, settings keys, lifecycle responsiveness, SPA polling.
- **Be wary of Amplience DOM changes.** Selectors here could be inherently fragile because the core app could change at any time. Document any selector with a comment explaining what it targets and what the fallback behaviour is if it disappears.
- **Work with the existing system functionality where sensible.** Conversely, triggering an existing function by emulating a button click means that, if the core team updates that functionality, the button click will still run the updated version of it. So balance these two aspects carefully to get the best resilience during platform updates.
- **Keep functionality within modules.** This allows for good maintenance practice, and easy enabling/disabling should a particular functionality fail, or not be wanted by the end user.
- **Update both the module README and the root CHANGELOG** when shipping behavioural changes. Keep root user-focused, keep module READMEs maintainer-focused.
- **Never add `manifest.json` permissions casually.** If something seems to need a new permission, surface that as a question.

## Useful skills for typical work here

- **engineering:debug** — when a module breaks after an Amplience UI change. Reproduce → isolate selector/event → fix.
- **engineering:code-review** — before merging PRs to `main`.
- **engineering:documentation** — for README and CHANGELOG updates.
- **engineering:deploy-checklist** — when prepping a Chrome Web Store release.
- **engineering:architecture** — when designing a substantial new module (ADR-worthy).
- **engineering:tech-debt** — periodic audits (e.g. retiring fragile selectors).
- **brand-tone-of-voice** — for Chrome Web Store listing copy or anything user-facing.

## Relationship to other extensions

- Hotkeys was merged in from the standalone [`amplience-hotkeys`](https://github.com/mattisherwood/amplience-hotkeys) extension at v2.0.
- Favicon Swapper is a hardcoded Amplience-specific subset of the standalone [`favicon-swapper`](https://github.com/mattisherwood/favicon-swapper) extension.

## Local environment

Personal paths and machine-specific notes for working on this repo live in `CLAUDE.local.md` (gitignored). If you're a contributor, create your own based on your setup.
