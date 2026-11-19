// Dashboard Home - new UI only
//
// Shows a placeholder dashboard at /<username> (instead of the app
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
  // /<username>
  const ROOT_PATH = /^\/([^/]+)\/?$/
  const USERNAME_PATH = /^\/([^/]+)(?:\/|$)/
  const LOGO_SELECTOR = '[data-testid="icon-bar:logo"]'
  const ICON_BAR_SELECTOR = '[data-testid="icon-bar"]' // the nav's own link hrefs are used
  const HEADER_SELECTOR = '[data-testid="app-header:portal"]'
  const MAIN_SELECTOR = '[data-testid="app-shell"] main'
  const ACTIVE_ATTRIBUTE = "data-amplience-dashboard-home-active"
  const OVERLAY_ID = "amplience-dashboard-home"
  const POLL_MS = 250
  const LINK_FALLBACK_MS = 150
  // /<username>/content/<hub>/... or /<username>/flows/<hub>: which hub the
  // user was last on. The guard records the same for a redirect it swallowed.
  const HUB_PATH = /^\/[^/]+\/(?:content|flows)\/([^/]+)/
  const HUB_ATTRIBUTE = "data-amplience-dashboard-home-hub"
  const HUB_SEQ_ATTRIBUTE = "data-amplience-dashboard-home-hub-seq"
  // The built-in content report; always the first tab and the default.
  const OVERVIEW_ID = "overview"
  const OVERVIEW_LABEL = "Content overview"

  let enabled = false
  let pollTimer = null
  let resizeObserver = null
  let headerPane = null
  let mainPane = null
  // Dashboard extensions for the current hub (see dashboard-home.host.js).
  let hubName = null
  let lastHubSeq = null
  let model = { status: "idle", hubName: null, dashboards: [], hub: null, message: "" }
  let selectedId = null
  let disconnectFrame = null

  // A single-segment path is the username root only if the icon bar's links live
  // under it, which rules out /login and the like.
  function isDashboardPath() {
    const root = window.location.pathname.match(ROOT_PATH)
    if (!root) return false
    return Array.from(
      document.querySelectorAll(`${ICON_BAR_SELECTOR} a[href]`),
    ).some((link) => link.getAttribute("href").startsWith(`/${root[1]}/`))
  }

  // ---- placeholder ---------------------------------------------------------

  function el(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text) node.textContent = text
    return node
  }

  function renderTabs() {
    const tabs = el("div", "amplience-dashboard-home__tabs")
    if (model.status !== "ready") return tabs
    const entries = [{ id: OVERVIEW_ID, label: OVERVIEW_LABEL }].concat(model.dashboards)
    entries.forEach((dashboard) => {
      const tab = el("button", "amplience-dashboard-home__tab", dashboard.label)
      tab.type = "button"
      tab.setAttribute("aria-pressed", String(dashboard.id === selectedId))
      tab.addEventListener("click", () => {
        selectedId = dashboard.id
        render()
      })
      tabs.appendChild(tab)
    })
    return tabs
  }

  function messageFor() {
    if (model.status === "loading") return "Loading dashboards\u2026"
    if (model.status === "error") return model.message
    if (model.status === "nohub") {
      return "Open a hub first, then return here to see its dashboards."
    }
    return ""
  }

  // The selected dashboard's extension fills the whole page area; anything
  // else (loading, none registered, an error) is a short message.
  function renderMain() {
    if (disconnectFrame) disconnectFrame()
    disconnectFrame = null
    mainPane.replaceChildren()
    const dashboard = model.dashboards.find((item) => item.id === selectedId)
    if (model.status === "ready" && !dashboard) {
      // The built-in content report.
      const report = el("div", "amplience-dashboard-home__scroll")
      mainPane.appendChild(report)
      globalThis.AmplienceDashboardHomeOverview.render(report, model.hub)
    } else if (model.status === "ready") {
      const frame = el("iframe", "amplience-dashboard-home__frame")
      frame.title = dashboard.label
      frame.setAttribute("sandbox", host().sandboxFor(dashboard))
      mainPane.appendChild(frame)
      disconnectFrame = host().connect(frame, dashboard, model.hub)
    } else {
      mainPane.appendChild(el("p", "amplience-dashboard-home__message", messageFor()))
    }
  }

  function render() {
    if (!headerPane || !mainPane) return
    headerPane.replaceChildren(renderTabs())
    renderMain()
  }

  function host() {
    return globalThis.AmplienceDashboardHomeHost
  }

  // Look up the hub's dashboards once per hub (the host caches successes).
  function load() {
    if (model.hubName === hubName && model.status !== "idle") return
    const requested = hubName
    if (!requested) {
      model = { status: "nohub", hubName: null, dashboards: [], hub: null, message: "" }
      render()
      return
    }
    model = { status: "loading", hubName: requested, dashboards: [], hub: null, message: "" }
    render()
    host().listDashboards(requested).then(
      (result) => {
        if (model.hubName !== requested) return
        model = { status: "ready", hubName: requested, dashboards: result.dashboards, hub: result.hub, message: "" }
        // Open on the content overview unless the user's last tab still exists.
        if (!result.dashboards.some((item) => item.id === selectedId)) {
          selectedId = OVERVIEW_ID
        }
        render()
      },
      (error) => {
        if (model.hubName !== requested) return
        const detail = error && error.data && error.data.errors
          ? error.data.errors[0].message
          : (error && error.message) || "Unknown error"
        model = { status: "error", hubName: requested, dashboards: [], hub: null, message: `Couldn't load this hub's dashboards: ${detail}` }
        render()
      },
    )
  }

  // The hub is the one in the URL when there is one. On the dashboard there
  // isn't, so use what the guard recorded from a navigation it swallowed (the
  // redirect on load, or a hub chosen in the picker); a new sequence number
  // means it recorded something new.
  function rememberHub() {
    const fromUrl = window.location.pathname.match(HUB_PATH)
    if (fromUrl) {
      hubName = decodeURIComponent(fromUrl[1])
    }
    const seq = document.documentElement.getAttribute(HUB_SEQ_ATTRIBUTE)
    if (seq !== lastHubSeq) {
      lastHubSeq = seq
      hubName = document.documentElement.getAttribute(HUB_ATTRIBUTE) || hubName
    }
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
    mainPane = el("div", "amplience-dashboard-home__main")
    overlay.append(headerPane, mainPane)
    document.body.appendChild(overlay)
    document.documentElement.setAttribute(ACTIVE_ATTRIBUTE, "")

    resizeObserver = new ResizeObserver(layout)
    resizeObserver.observe(header)
    resizeObserver.observe(main)
    window.addEventListener("resize", layout)
    layout()
    load()
  }

  function hidePlaceholder() {
    const overlay = document.getElementById(OVERLAY_ID)
    if (!overlay) return
    if (resizeObserver) resizeObserver.disconnect()
    resizeObserver = null
    window.removeEventListener("resize", layout)
    if (disconnectFrame) disconnectFrame()
    disconnectFrame = null
    overlay.remove()
    document.documentElement.removeAttribute(ACTIVE_ATTRIBUTE)
    // Look the hub up afresh next time (retries after an error).
    model = { status: "idle", hubName: null, dashboards: [], hub: null, message: "" }
    headerPane = null
    mainPane = null
  }

  function sync() {
    if (!enabled) return
    rememberHub()
    if (isDashboardPath()) {
      showPlaceholder()
      if (headerPane && hubName !== model.hubName) load()
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

  // Route to the dashboard ourselves when the logo is clicked.
  // (The router then tries to redirect; the guard swallows that.)
  //
  // The reverse case: the router still thinks it's on the content list under
  // the placeholder, so clicking the icon-bar link for that same page makes
  // it do nothing. If the URL hasn't left the dashboard shortly after a click
  // on an icon-bar link, route there ourselves.
  function onDocumentClick(event) {
    if (!enabled || !event.target.closest) return

    if (event.target.closest(LOGO_SELECTOR)) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const username = window.location.pathname.match(USERNAME_PATH)
      if (username && !isDashboardPath()) {
        routeTo(`/${username[1]}`)
      }
      return
    }

    const link = event.target.closest(`${ICON_BAR_SELECTOR} a[href]`)
    if (link && isDashboardPath()) {
      setTimeout(() => {
        if (enabled && isDashboardPath()) {
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

  chrome.storage.sync.get({ [STORAGE_KEY]: true }, (settings) => {
    apply(settings[STORAGE_KEY])
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[STORAGE_KEY]) {
      apply(Boolean(changes[STORAGE_KEY].newValue))
    }
  })
})()
