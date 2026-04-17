[< Back](../../README.md)

# Favicon Swapper

This is a stripped-back version of Matt Isherwood's [Favicon Swapper](https://github.com/mattisherwood/favicon-swapper) browser extension.

While the full extension allows customisation (for the user to choose which icons to use and where to get the title content from) this one is simply hardcoded for the Amplience interfaces. This keeps it simple, secure, foolproof and more performant.

## What does it do?

1. **Helpful Favicons:** Swaps the favicons to reflect which area of the site the user is on. (The Dynamic Content CMS, the DAM Asset Stores, or the Workforce apps)

2. **Context-Aware Titles:** Picks up the title of the item you are currently editing to help differentiate between different tabs (e.g. "Homepage Carousel | Dynamic Content" in one tab and "Webhooks | Dynamic Content" in the other)

## Enable Or Disable

- Extension popup: toggle **Enable Favicon Swapper**
- Extension options page: toggle **Enable Favicon Swapper**
- Setting key: `faviconSwapperEnabled` in `chrome.storage.sync`

## What It Does

- On each matching URL, sets `link[rel="icon"]` to the bundled `.ico` for that area
- Prepends a page-specific title prefix (e.g. the repo name in Dynamic Content) to the browser tab title
- Polls the DOM for up to ~7 seconds after navigation to catch Angular hydration
- Reacts to SPA navigation (`pushState`, `replaceState`, `popstate`) and DOM mutations so the icon/title stay accurate without a full page reload

## Files

- `favicon-swapper.js`: Reads the enabled setting, applies icons and titles, and manages start/stop lifecycle
- `icons/`: Bundled `.ico` files for each Amplience area (Dynamic Content, Content Hub, Workforce)

## Development Notes

1. To add or change a target URL, update the `RULES` array in `favicon-swapper.js`
2. `titleSelector` is a CSS selector — the first matched element's `innerText` is prepended to the tab title; leave it empty to skip title modification for that rule
3. Icon files must be listed under `web_accessible_resources` in `manifest.json` to be loadable by the page
