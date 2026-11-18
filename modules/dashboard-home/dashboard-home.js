// Dashboard Home - new UI only
//
// Shows a placeholder dashboard at /client-<id> (instead of the app
// redirecting to the first repository's content list), and makes the logo at
// the top of the icon bar navigate to it.
//
// Split across two scripts:
//  - dashboard-home.guard.js (page world) stops the app's redirect.
//  - this file (extension world) owns the toggle, the placeholder, and the
//    logo click. It marks <html data-amplience-dashboard-home="enabled">,
//    which the guard and all of the CSS key off.
//
// Selectors (the app's CSS-module class names are hashed, so only data-testid
// hooks are used; each comment says what happens if it disappears):
//  - [data-testid="icon-bar:logo"]      the logo. Gone: the logo isn't clickable;
//                                       the placeholder is still reachable by URL.
//  - [data-testid="app-header:portal"]  the header's left area (page tabs). Gone:
//                                       the placeholder isn't shown.
//  - [data-testid="app-shell"] main     the page area. Gone: as above.
//  When the placeholder isn't shown the app just behaves as Amplience ships it.

;(function () {
  "use strict"

  const STORAGE_KEY = "dashboardHomeEnabled"
  const ATTRIBUTE = "data-amplience-dashboard-home"
  const DASHBOARD_PATH = /^\/(client-[^/]+)\/?$/
  const CLIENT_PATH = /^\/(client-[^/]+)(?:\/|$)/
  const LOGO_SELECTOR = '[data-testid="icon-bar:logo"]'
  const ICON_BAR_SELECTOR = '[data-testid="icon-bar"]' // the nav's own link hrefs are used
  const HEADER_SELECTOR = '[data-testid="app-header:portal"]'
  const MAIN_SELECTOR = '[data-testid="app-shell"] main'
  const ACTIVE_ATTRIBUTE = "data-amplience-dashboard-home-active"
  const OVERLAY_ID = "amplience-dashboard-home"
  const POLL_MS = 250
  const LINK_FALLBACK_MS = 150
  const EXAMPLE_TABS = ["Overview", "Performance", "SEO Audit"]

  let enabled = false
  let pollTimer = null
  let resizeObserver = null
  let headerPane = null
  let mainPane = null

  // ---- placeholder ---------------------------------------------------------

  function el(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text) node.textContent = text
    return node
  }

  function buildTabs() {
    const tabs = el("div", "amplience-dashboard-home__tabs")
    EXAMPLE_TABS.forEach((title, index) => {
      const tab = el("button", "amplience-dashboard-home__tab", title)
      tab.type = "button"
      tab.setAttribute("aria-pressed", String(index === 0))
      tab.addEventListener("click", () => {
        tabs.querySelectorAll("button").forEach((other) => {
          other.setAttribute("aria-pressed", String(other === tab))
        })
      })
      tabs.appendChild(tab)
    })
    return tabs
  }

  function buildMain() {
    const pane = el("div", "amplience-dashboard-home__main")
    const top = el("div", "amplience-dashboard-home__top")
    top.appendChild(
      el(
        "h1",
        "amplience-dashboard-home__title",
        "Content Operations Overview",
      ),
    )
    top.appendChild(
      el(
        "div",
        "amplience-dashboard-home__actions",
        "ACTIONS/FILTER TOOLS GO HERE",
      ),
    )
    pane.appendChild(top)
    pane.appendChild(
      el("div", "amplience-dashboard-home__body", "DASHBOARD THINGS GO HERE"),
    )
    return pane
  }

  // Keep each pane exactly over the app element it hides, so the icon bar and
  // the header's right-hand controls (hub picker etc.) stay usable.
  function place(pane, target) {
    const rect = target.getBoundingClientRect()
    pane.style.top = `${rect.top}px`
    pane.style.left = `${rect.left}px`
    pane.style.width = `${rect.width}px`
    pane.style.height = `${rect.height}px`
  }

  function layout() {
    const header = document.querySelector(HEADER_SELECTOR)
    const main = document.querySelector(MAIN_SELECTOR)
    if (!header || !main || !headerPane || !mainPane) return
    place(headerPane, header)
    place(mainPane, main)
  }

  function showPlaceholder() {
    if (document.getElementById(OVERLAY_ID)) return
    const header = document.querySelector(HEADER_SELECTOR)
    const main = document.querySelector(MAIN_SELECTOR)
    if (!header || !main) return // not rendered yet; the poll tries again

    const overlay = el("div")
    overlay.id = OVERLAY_ID
    headerPane = el("div", "amplience-dashboard-home__header")
    headerPane.appendChild(buildTabs())
    mainPane = buildMain()
    overlay.append(headerPane, mainPane)
    document.body.appendChild(overlay)
    document.documentElement.setAttribute(ACTIVE_ATTRIBUTE, "")

    resizeObserver = new ResizeObserver(layout)
    resizeObserver.observe(header)
    resizeObserver.observe(main)
    window.addEventListener("resize", layout)
    layout()
  }

  function hidePlaceholder() {
    const overlay = document.getElementById(OVERLAY_ID)
    if (!overlay) return
    if (resizeObserver) resizeObserver.disconnect()
    resizeObserver = null
    window.removeEventListener("resize", layout)
    overlay.remove()
    document.documentElement.removeAttribute(ACTIVE_ATTRIBUTE)
    headerPane = null
    mainPane = null
  }

  function sync() {
    if (!enabled) return
    if (DASHBOARD_PATH.test(window.location.pathname)) {
      showPlaceholder()
    } else {
      hidePlaceholder()
    }
  }

  // ---- logo ----------------------------------------------------------------

  // Push a URL and fire popstate, the way the browser's own back/forward does,
  // so the app's router (which listens for popstate) follows.
  function routeTo(path) {
    window.history.pushState(window.history.state, "", path)
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: window.history.state }),
    )
  }

  // The logo is a plain div, not a link, so route to the dashboard ourselves.
  // (The router then tries to redirect; the guard swallows that.)
  //
  // The reverse case: the router still thinks it's on the content list under
  // the placeholder, so clicking the icon-bar link for that same page makes
  // it do nothing. If the URL hasn't left the dashboard shortly after a click
  // on an icon-bar link, route there ourselves.
  function onDocumentClick(event) {
    if (!enabled || !event.target.closest) return

    if (event.target.closest(LOGO_SELECTOR)) {
      const client = window.location.pathname.match(CLIENT_PATH)
      if (client && !DASHBOARD_PATH.test(window.location.pathname)) {
        routeTo(`/${client[1]}`)
      }
      return
    }

    const link = event.target.closest(`${ICON_BAR_SELECTOR} a[href]`)
    if (link && DASHBOARD_PATH.test(window.location.pathname)) {
      setTimeout(() => {
        if (enabled && DASHBOARD_PATH.test(window.location.pathname)) {
          routeTo(link.getAttribute("href"))
        }
      }, LINK_FALLBACK_MS)
    }
  }

  // ---- lifecycle -----------------------------------------------------------

  function start() {
    if (enabled) return
    enabled = true
    document.documentElement.setAttribute(ATTRIBUTE, "enabled")
    document.addEventListener("click", onDocumentClick, true)
    window.addEventListener("popstate", sync)
    // The app changes the URL from its own world, which we can't hook from
    // here, so check the path on a light timer (this also covers late rendering).
    pollTimer = setInterval(sync, POLL_MS)
    sync()
  }

  function stop() {
    if (!enabled) return
    enabled = false
    document.documentElement.removeAttribute(ATTRIBUTE)
    document.removeEventListener("click", onDocumentClick, true)
    window.removeEventListener("popstate", sync)
    clearInterval(pollTimer)
    pollTimer = null
    hidePlaceholder()
  }

  function apply(value) {
    if (value) start()
    else stop()
  }

  chrome.storage.sync.get({ [STORAGE_KEY]: false }, (settings) => {
    apply(settings[STORAGE_KEY])
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[STORAGE_KEY]) {
      apply(Boolean(changes[STORAGE_KEY].newValue))
    }
  })
})()
