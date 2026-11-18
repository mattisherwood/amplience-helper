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
// Only redirects are swallowed. A replaceState/pushState that follows a real
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

  const LOGO_SELECTOR = '[data-testid="icon-bar:logo"]' // our own link to the dashboard

  let lastUserInput = 0
  const noteInput = (event) => {
    // Clicking the logo navigates *to* the dashboard, so the redirect that
    // follows must not count as the user's own navigation.
    if (event.target.closest && event.target.closest(LOGO_SELECTOR)) return
    lastUserInput = Date.now()
  }
  window.addEventListener("pointerdown", noteInput, true)
  window.addEventListener("keydown", noteInput, true)

  const nativeReplaceState = history.replaceState

  history.replaceState = function (state, unused, url) {
    try {
      const root = window.location.pathname.match(ROOT_PATH)
      if (
        document.documentElement.getAttribute(ATTRIBUTE) === "enabled" &&
        root &&
        url != null &&
        // Only a redirect from the username root into the app proper (/<username>/...)
        new URL(url, window.location.href).pathname.startsWith(`/${root[1]}/`) &&
        Date.now() - lastUserInput > USER_INPUT_GRACE_MS
      ) {
        return
      }
    } catch (error) {
      // Unparseable URL: fall through to the native behaviour.
    }

    return nativeReplaceState.apply(this, arguments)
  }
})()
