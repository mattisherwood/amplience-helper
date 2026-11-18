// Dashboard Home - page-world redirect guard (new UI only)
//
// Runs in the page's own JavaScript world ("world": "MAIN" in manifest.json,
// at document_start) because only the page's own history.replaceState calls
// can be intercepted from there.
//
// Why it's needed (verified 2026-11-18): visiting /<username> in the new UI
// makes the app's router redirect, client-side, to the first repository's
// content list (a chain of history.replaceState calls ending in
// /<username>/content/<hub>/content-items?repoId=...). There is no HTTP
// redirect to stop. So while the toggle is on we swallow those redirect calls
// and the URL stays at /<username>; the isolated script
// (dashboard-home.js) covers the app with the placeholder dashboard.
//
// Choosing a hub in the hub picker while on the dashboard is also held at
// /<username>: the app would otherwise navigate to the new hub's content list
// (it keeps the current page type when switching, and thinks it is on the
// content list). Those navigations are swallowed for a short window after the
// pick and the new hub is recorded for dashboard-home.js, so the dashboard
// follows the hub like every other page does.
//
// Other than that, only redirects are swallowed. A replaceState/pushState that follows a real
// click or keypress (e.g. choosing Content in the icon bar) is let through,
// so the user can always navigate away. The isolated script flips the
// attribute below on and off from the module toggle; if it's absent this
// script does nothing at all.
//
// If the app stops redirecting, or renames the routes, nothing is swallowed
// and the app behaves as Amplience ships it.

;(function () {
  "use strict"

  const ATTRIBUTE = "data-amplience-dashboard-home"
  // The bare username root: /<username>
  const ROOT_PATH = /^\/([^/]+)\/?$/
  const USER_INPUT_GRACE_MS = 1000 // a replace this soon after input is the user's
  // Remembers which hub the swallowed redirect was heading to (for the
  // dashboards lookup in dashboard-home.js).
  const HUB_PATH = /^\/[^/]+\/(?:content|flows)\/([^/]+)/
  const HUB_ATTRIBUTE = "data-amplience-dashboard-home-hub"
  // Bumped each time a hub is recorded, so the same hub twice still registers.
  const HUB_SEQ_ATTRIBUTE = "data-amplience-dashboard-home-hub-seq"
  // The hub picker and its open-state marker, and the dropdown's options.
  // Gone or renamed: switching hubs on the dashboard jumps to content, as before.
  const HUB_SELECT_OPEN = '[data-testid="hub-select"][data-expanded="true"]'
  const HUB_OPTION = ".mantine-Combobox-option"
  const HUB_PICK_WINDOW_MS = 1500
  let hubPickedAt = 0

  const LOGO_SELECTOR = '[data-testid="icon-bar:logo"]' // our own link to the dashboard

  let lastUserInput = 0
  const noteInput = (event) => {
    // Clicking the logo navigates *to* the dashboard, so the redirect that
    // follows must not count as the user's own navigation.
    if (event.target.closest && event.target.closest(LOGO_SELECTOR)) return
    lastUserInput = Date.now()
  }
  window.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest &&
        event.target.closest(HUB_OPTION) &&
        document.querySelector(HUB_SELECT_OPEN)
      ) {
        hubPickedAt = Date.now()
      }
    },
    true,
  )
  window.addEventListener("pointerdown", noteInput, true)
  window.addEventListener("keydown", noteInput, true)

  const nativePushState = history.pushState
  const nativeReplaceState = history.replaceState

  // True (and the hub recorded) when this navigation should be swallowed.
  function swallow(url, isReplace) {
    try {
      const root = window.location.pathname.match(ROOT_PATH)
      if (
        document.documentElement.getAttribute(ATTRIBUTE) !== "enabled" ||
        !root ||
        url == null
      ) {
        return false
      }
      const path = new URL(url, window.location.href).pathname
      // Only navigation from the username root into the app proper (/<username>/...)
      if (!path.startsWith(`/${root[1]}/`)) return false
      const picked = Date.now() - hubPickedAt < HUB_PICK_WINDOW_MS
      if (!picked && !(isReplace && Date.now() - lastUserInput > USER_INPUT_GRACE_MS)) {
        return false
      }
      const hub = path.match(HUB_PATH)
      if (hub) {
        const html = document.documentElement
        html.setAttribute(HUB_ATTRIBUTE, decodeURIComponent(hub[1]))
        html.setAttribute(HUB_SEQ_ATTRIBUTE, String(Date.now()))
      }
      return true
    } catch (error) {
      // Unparseable URL: fall through to the native behaviour.
      return false
    }
  }

  history.pushState = function (state, unused, url) {
    return swallow(url, false) ? undefined : nativePushState.apply(this, arguments)
  }

  history.replaceState = function (state, unused, url) {
    return swallow(url, true) ? undefined : nativeReplaceState.apply(this, arguments)
  }
})()
