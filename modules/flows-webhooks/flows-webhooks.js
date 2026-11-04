// Flows Webhooks - classic Workforce UI (app.amplience.net/content-studio)
//
// Adds a "Webhooks" tab to the flow listing's Flows / Runs / Reviews tab bar.
// The data, masking and list rendering live in flows-webhooks.core.js, shared
// with the new UI's host (flows-webhooks.nextgen.js). This file only decides
// when the tab belongs on the page, where it goes, and how activating it
// swaps the panels. Once the classic app is retired it can be deleted
// without touching the core or the new UI's host.

;(function () {
  "use strict"

  const core = globalThis.AmplienceFlowsWebhooks

  if (!core) {
    console.error("[Amplience Helper] flows-webhooks.core.js not loaded")
    return
  }

  const DEFAULT_SETTINGS = {
    flowsWebhooksEnabled: true,
  }

  // <html> attributes. ENABLED_ATTRIBUTE gates every rule in
  // flows-webhooks.css, so flipping the toggle off instantly reverts the page.
  // VIEW_ATTRIBUTE is only present while our tab is the visible one - that is
  // what hides Amplience's own tab panels, via CSS rather than by touching the
  // inline styles React owns.
  const ENABLED_ATTRIBUTE = "data-amplience-flows-webhooks"
  const VIEW_ATTRIBUTE = "data-amplience-webhooks-view"

  const TAB_ID = "flows-webhooks-tab"
  const PANEL_ID = "flows-webhooks-panel"
  const TAB_LABEL = "Webhooks"
  const HASH = "#webhooks"

  const SYNC_DEBOUNCE = 150

  // Drawn at stroke-width 1.5 to match the weight of the classic app's
  // Flows/Runs/Reviews tab icons rather than the logo's heavier lockup.
  const ICON_SVG = core.tabIconSvg({ size: 16, strokeWidth: 1.5 })

  let enabled = false
  let viewActive = false
  let syncTimeout = null
  let pageObserver = null

  // In the classic app the hub ID is right there in the URL, so there is
  // nothing to resolve.
  const panel = core.createPanel({
    id: PANEL_ID,
    getHubId: function () {
      return extractHubIdFromUrl()
    },
  })

  /* ---------------------------------------------------------------- routing */

  /*
   * Tab sub-routes that still render the flow listing's tab bar.
   *
   * Amplience routes only `reviews` - verified against the live app:
   * /content-flows/reviews renders the tab bar with Reviews active, while
   * /content-flows/runs and /content-flows/flows render an empty page (those
   * routes do not exist). Anything else after /content-flows is a flow id,
   * and flow detail pages have no tab bar, so an allowlist is what keeps us
   * off them - a length check alone would match every flow.
   */
  const LISTING_SUBROUTES = ["reviews"]

  function isFlowsListingPage() {
    const segments = window.location.pathname.split("/").filter(Boolean)
    const index = segments.indexOf("content-flows")

    if (index === -1) {
      return false
    }

    const rest = segments.slice(index + 1)

    if (!rest.length) {
      return true
    }

    return rest.length === 1 && LISTING_SUBROUTES.indexOf(rest[0]) !== -1
  }

  function extractHubIdFromUrl() {
    const segments = window.location.pathname.split("/").filter(Boolean)
    const studioIndex = segments.indexOf("content-studio")

    if (studioIndex === -1 || studioIndex + 1 >= segments.length) {
      return null
    }

    return decodeURIComponent(segments[studioIndex + 1]) || null
  }

  /* ------------------------------------------------------------------- DOM  */

  // The flows page wraps Flows/Runs/Reviews in one Mantine Tabs component.
  // data-testid="tabs" is the stable hook; the hashed mantine-Tabs-root class
  // is the fallback. If neither resolves the module does nothing at all and
  // the page behaves exactly as Amplience ships it.
  function getTabsRoot() {
    return (
      document.querySelector('[data-testid="tabs"]') ||
      document.querySelector(".mantine-Tabs-root")
    )
  }

  function getTabList(root) {
    return root
      ? root.querySelector('[role="tablist"]') ||
          root.querySelector(".mantine-Tabs-list")
      : null
  }

  function getNativeTabs() {
    const root = getTabsRoot()

    if (!root) {
      return []
    }

    return Array.prototype.filter.call(
      root.querySelectorAll('[role="tab"]'),
      function (tab) {
        return tab.id !== TAB_ID
      },
    )
  }

  // Cloning a real tab is deliberate: Amplience's Mantine classes are hashed
  // and change between builds, so a clone keeps matching the genuine tabs
  // through restyles in a way hand-written markup would not.
  function buildTab(template) {
    const tab = template.cloneNode(true)

    tab.id = TAB_ID
    tab.removeAttribute("aria-controls")
    tab.removeAttribute("data-testid")
    tab.removeAttribute("data-active")
    tab.setAttribute("aria-selected", "false")
    tab.setAttribute("tabindex", "-1")
    tab.setAttribute("data-amplience-injected", "true")

    const label = tab.querySelector(".mantine-Tabs-tabLabel")

    if (label) {
      label.textContent = TAB_LABEL
    } else {
      tab.textContent = TAB_LABEL
    }

    const section = tab.querySelector(".mantine-Tabs-tabSection")

    if (section) {
      section.innerHTML = ICON_SVG
    }

    tab.addEventListener("click", function (event) {
      event.preventDefault()
      event.stopPropagation()
      activateView()
    })

    return tab
  }

  /*
   * The module reconciles the page to the state it wants, rather than trying
   * to catch every navigation mechanism Amplience might use. Arriving at the
   * flows list can mean a real page load, a router pushState, a popstate, or
   * a React remount with no URL change at all - and the tab bar renders some
   * time after whichever of those happened. Every path ends up here, and the
   * only question asked is "should the tab be on the page right now, and is
   * it?".
   */
  function syncUi() {
    if (!enabled) {
      return
    }

    if (!isFlowsListingPage()) {
      if (document.getElementById(TAB_ID) || panel.element.isConnected) {
        deactivateView(false)
        removeUi()
      }
      return
    }

    const root = getTabsRoot()
    const list = getTabList(root)
    // Never clone our own tab - after a re-render ours can be the first match.
    const template = list
      ? list.querySelector('[role="tab"]:not(#' + TAB_ID + ")")
      : null

    if (!root || !list || !template) {
      // The tab bar has not rendered yet. The page observer calls us again as
      // soon as it does, so there is nothing to retry and nothing to time out.
      return
    }

    let injected = false

    if (!document.getElementById(TAB_ID)) {
      list.appendChild(buildTab(template))
      injected = true
    }

    // The same panel element every time - re-attaching it keeps any
    // expanded schema and the fetched list.
    if (panel.element.parentNode !== root) {
      root.appendChild(panel.element)
      injected = true
    }

    // Re-apply the active state after a re-injection: a React re-render can
    // drop our nodes while the user is still looking at our tab.
    if (injected && (viewActive || window.location.hash === HASH)) {
      activateView()
    }
  }

  function scheduleSync() {
    clearTimeout(syncTimeout)
    syncTimeout = setTimeout(syncUi, SYNC_DEBOUNCE)
  }

  function removeUi() {
    const tab = document.getElementById(TAB_ID)

    if (tab) {
      tab.remove()
    }

    panel.element.remove()

    // An open create/edit dialog belongs to the panel; don't leave it behind.
    if (core.closeEditor) {
      core.closeEditor()
    }
  }

  /*
   * One observer on <body>, the same fallback flows-migration relies on. This
   * is what makes the module work when the user navigates to the flows list
   * client-side rather than loading it directly: at that moment there is no
   * tab bar to observe, and no guarantee the route change arrived through an
   * event we hooked. The callback is debounced and does three cheap lookups,
   * so the cost on a busy page stays negligible.
   */
  function startObserving() {
    if (pageObserver) {
      return
    }

    pageObserver = new MutationObserver(function () {
      if (!enabled) {
        return
      }

      // Only pay for a sync when the page and the wanted state disagree.
      if (isFlowsListingPage() !== Boolean(document.getElementById(TAB_ID))) {
        scheduleSync()
      }
    })

    pageObserver.observe(document.body, { childList: true, subtree: true })
  }

  function stopObserving() {
    if (pageObserver) {
      pageObserver.disconnect()
      pageObserver = null
    }
  }

  /* ---------------------------------------------------------- view activation */

  // Mantine paints the active tab from data-active. React does not know our
  // tab exists, so while our view is showing we take the flag off whichever
  // native tab holds it and put it back on deactivate - otherwise the page
  // would render two active tabs, or none.
  function markTabActive(active) {
    const tab = document.getElementById(TAB_ID)

    if (tab) {
      if (active) {
        tab.setAttribute("data-active", "true")
        tab.setAttribute("aria-selected", "true")
        tab.setAttribute("tabindex", "0")
      } else {
        tab.removeAttribute("data-active")
        tab.setAttribute("aria-selected", "false")
        tab.setAttribute("tabindex", "-1")
      }
    }

    getNativeTabs().forEach(function (native) {
      if (active) {
        if (native.getAttribute("data-active") === "true") {
          native.setAttribute("data-amplience-was-active", "true")
          native.removeAttribute("data-active")
        }
      } else if (native.getAttribute("data-amplience-was-active") === "true") {
        native.removeAttribute("data-amplience-was-active")
        native.setAttribute("data-active", "true")
      }
    })
  }

  function activateView() {
    if (!enabled || !isFlowsListingPage()) {
      return
    }

    viewActive = true
    document.documentElement.setAttribute(VIEW_ATTRIBUTE, "active")
    markTabActive(true)

    // Setting the hash keeps the view deep-linkable and makes the browser's
    // back button return to the Flows tab.
    if (window.location.hash !== HASH) {
      window.location.hash = HASH
    }

    panel.load(false)
  }

  function deactivateView(clearHash) {
    viewActive = false
    document.documentElement.removeAttribute(VIEW_ATTRIBUTE)
    markTabActive(false)
    panel.remask()

    if (clearHash && window.location.hash === HASH) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      )
    }
  }

  function handleNativeTabClick(event) {
    if (!enabled || !viewActive) {
      return
    }

    const target = event.target

    if (!target || typeof target.closest !== "function") {
      return
    }

    const tab = target.closest('[role="tab"]')

    if (!tab || tab.id === TAB_ID) {
      return
    }

    // Runs before React's own handler, so the tab the user clicked ends up
    // active and our panel is already out of the way.
    deactivateView(true)
  }

  function handleHashChange() {
    if (!enabled || !isFlowsListingPage()) {
      return
    }

    if (window.location.hash === HASH) {
      // Our own activateView sets the hash, so this fires straight back at
      // us. Re-activating would re-render the list and drop any revealed row.
      if (!viewActive) {
        activateView()
      }
    } else if (viewActive) {
      deactivateView(false)
    }
  }

  /* ------------------------------------------------------------- lifecycle  */

  function start() {
    document.documentElement.setAttribute(ENABLED_ATTRIBUTE, "enabled")
    startObserving()
    syncUi()
  }

  function stop() {
    clearTimeout(syncTimeout)
    stopObserving()
    deactivateView(true)
    removeUi()
    document.documentElement.removeAttribute(ENABLED_ATTRIBUTE)
    panel.resetCache()
  }

  /*
   * Amplience is a single-page app, so a route change never reloads the page.
   * These hooks are the fast path - they get the tab up as soon as the URL
   * changes instead of waiting for the next DOM mutation - but they are not
   * load-bearing: the <body> observer catches anything they miss, including a
   * router that kept its own reference to history.pushState before we patched
   * it, and a tab bar that renders long after the URL changed.
   */
  function hookNavigation() {
    const pushState = history.pushState
    const replaceState = history.replaceState

    history.pushState = function () {
      pushState.apply(history, arguments)
      scheduleSync()
    }

    history.replaceState = function () {
      replaceState.apply(history, arguments)
      scheduleSync()
    }

    window.addEventListener("popstate", scheduleSync)
    window.addEventListener("hashchange", handleHashChange)
    document.addEventListener("click", handleNativeTabClick, true)
  }

  function applySetting(nextEnabled) {
    const value = Boolean(nextEnabled)

    if (value === enabled) {
      return
    }

    enabled = value

    if (enabled) {
      start()
    } else {
      stop()
    }
  }

  function init() {
    hookNavigation()

    chrome.storage.sync.get(DEFAULT_SETTINGS, function (settings) {
      applySetting(settings.flowsWebhooksEnabled)
    })

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "sync" && changes.flowsWebhooksEnabled) {
        applySetting(changes.flowsWebhooksEnabled.newValue)
      }
    })
  }

  init()
})()
