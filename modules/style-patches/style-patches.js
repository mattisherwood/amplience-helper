;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    stylesEnabled: true,
  }

  const WORKFORCE_LINK_SELECTOR =
    '[data-amplience-enhanced-naming-workforce-link="true"]'
  const SWITCHEROO_APP_LIST_SELECTOR =
    ".switcheroo__primary-applist, .switcheroo-menu__primary-actions"

  let patchObserver = null
  let stylesEnabled = false
  let reconciledUrl = null
  let tabClickInFlight = false
  let tabClickRelease = null

  function createWorkforceLink() {
    const template = document.createElement("template")
    template.innerHTML = `
      <span class="switcheroo-item switcheroo-item--primary" aria-label="Workforce will be accessible once your organization admin finalizes your account setup" md-labeled-by-tooltip="md-tooltip-16" data-amplience-enhanced-naming-workforce-link="true">
        <a href="https://app.amplience.net/content-studio/" ng-click="disabled ? $event.preventDefault() : null" ng-attr-tabindex="{{ disabled ? -1 : 0 }}" tabindex="0">
          <div class="switcheroo__primary-app switcheroo__primary-app--wf" ng-class="{'switcheroo__primary-app--disabled': disabled, 'switcheroo__primary-app--wf': !disabled}" style="">
            <div class="switcheroo__primary-app-arrow icon-container" amp-icon="ic-arrow-right-grey">
              <svg width="25" height="16" viewBox="0 0 25 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
                <path d="M24.7071 8.70711C25.0976 8.31658 25.0976 7.68342 24.7071 7.29289L18.3431 0.928932C17.9526 0.538408 17.3195 0.538408 16.9289 0.928932C16.5384 1.31946 16.5384 1.95262 16.9289 2.34315L22.5858 8L16.9289 13.6569C16.5384 14.0474 16.5384 14.6805 16.9289 15.0711C17.3195 15.4616 17.9526 15.4616 18.3431 15.0711L24.7071 8.70711ZM0 9H24V7H0V9Z" fill="#737589"></path>
              </svg>
            </div>
            <div class="switcheroo__primary-app-text">
              <p class="switcheroo__primary-app-text-content">Workforce</p>
            </div>
            <div class="switcheroo__primary-app-icon icon-container" amp-icon="ic-wf">
              <svg width="100%" height="100%" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" fit="" preserveAspectRatio="xMidYMid meet" focusable="false">
                <path d="M381.662 116.232C393.431 141.713 400 170.089 400 200C400 310.457 310.457 400 200 400C136.541 400 79.9878 370.443 43.3486 324.348C58.3951 284.599 108.148 226.011 123.43 219.058C176.772 194.789 214.376 267.59 267.086 245.576C311.385 227.074 357.39 151.331 381.662 116.232Z" fill="url(#paint0_linear_4899_131)"></path>
                <path d="M200 0C264.131 0 321.209 30.1857 357.809 77.1221C340.826 116.624 294.35 170.935 279.672 177.614C226.33 201.884 188.725 129.082 136.016 151.096C89.953 170.334 42.0443 251.463 18.6436 284.433C6.68083 258.781 0 230.171 0 200C0 89.5431 89.5431 0 200 0Z" fill="url(#paint1_linear_4899_131)"></path>
                <defs>
                  <linearGradient id="paint0_linear_4899_131" x1="101.768" y1="379.368" x2="337.413" y2="-14.5436" gradientUnits="userSpaceOnUse">
                    <stop offset="0.0472256" stop-color="#7C81FF"></stop>
                    <stop offset="0.485343" stop-color="#9747FF"></stop>
                    <stop offset="1" stop-color="#F8855D"></stop>
                  </linearGradient>
                  <linearGradient id="paint1_linear_4899_131" x1="101.768" y1="379.368" x2="337.413" y2="-14.5436" gradientUnits="userSpaceOnUse">
                    <stop offset="0.0472256" stop-color="#7C81FF"></stop>
                    <stop offset="0.485343" stop-color="#9747FF"></stop>
                    <stop offset="1" stop-color="#F8855D"></stop>
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </a>
      </span>
    `.trim()

    return template.content.firstElementChild
  }

  function insertWorkforceLink() {
    const appList = document.querySelector(SWITCHEROO_APP_LIST_SELECTOR)
    if (!appList) {
      return
    }

    if (appList.querySelector(WORKFORCE_LINK_SELECTOR)) {
      return
    }

    const workforceLink = createWorkforceLink()
    appList.appendChild(workforceLink)
  }

  function removeWorkforceLink() {
    document.querySelectorAll(WORKFORCE_LINK_SELECTOR).forEach((node) => {
      node.remove()
    })
  }

  function startPatchObserver() {
    if (patchObserver) {
      return
    }

    patchObserver = new MutationObserver(() => {
      insertWorkforceLink()
      restoreTabFromUrl()
    })

    patchObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  function stopPatchObserver() {
    if (!patchObserver) {
      return
    }

    patchObserver.disconnect()
    patchObserver = null
  }

  /* ----------------------------------------- flow tab URL persistence ---- */

  /*
   * Amplience's flow tab bar is inconsistently routed. Verified against the
   * live app: `reviews` has a real route, `runs` and `flows` have none (going
   * to them directly renders an empty page), and clicking any tab never
   * writes back to the URL. So the URL sets the initial tab but never
   * follows it - land on /content-flows/reviews, click Flows, refresh, and
   * you are back on Reviews. Runs cannot be linked to at all.
   *
   * This patch keeps the URL and the active tab in step:
   *
   *   Flows    ->  /content-flows           bare - the app's own default tab
   *   Runs     ->  /content-flows#runs      no route exists, so a hash
   *   Reviews  ->  /content-flows/reviews   the app's own route
   *
   * Restoring works by clicking Amplience's own tab rather than reaching into
   * React state, so if the core team reworks tab switching the click still
   * runs whatever the new implementation does.
   */
  const FLOW_TAB_VALUES = ["flows", "runs", "reviews"]
  const FLOW_TAB_HASHES = { runs: "#runs" }
  const FLOW_TABS_MARKER = "/content-flows"

  function isFlowsListingPath() {
    const segments = window.location.pathname.split("/").filter(Boolean)
    const index = segments.indexOf("content-flows")

    if (index === -1) {
      return false
    }

    const rest = segments.slice(index + 1)

    // Anything else after /content-flows is a flow id, and flow detail pages
    // have no tab bar.
    return !rest.length || (rest.length === 1 && rest[0] === "reviews")
  }

  function flowTabsBasePath() {
    const path = window.location.pathname
    const at = path.indexOf(FLOW_TABS_MARKER)

    return at === -1 ? null : path.slice(0, at + FLOW_TABS_MARKER.length)
  }

  // Mantine ids look like `mantine-<uid>-tab-runs`.
  function getFlowTab(value) {
    return document.querySelector('[role="tab"][id$="-tab-' + value + '"]')
  }

  function flowTabValueFromElement(tab) {
    for (let i = 0; i < FLOW_TAB_VALUES.length; i++) {
      if (tab.id && tab.id.endsWith("-tab-" + FLOW_TAB_VALUES[i])) {
        return FLOW_TAB_VALUES[i]
      }
    }

    return null
  }

  /*
   * Which tab the current URL implies. Null means "leave the tab alone".
   *
   * The hash is checked BEFORE the path, and any hash we do not own makes
   * this return null. That matters on the reviews route: when flows-webhooks
   * activates its tab it sets #webhooks while the path still reads
   * /content-flows/reviews. Letting the path win there meant clicking
   * Webhooks was immediately undone - we would click Reviews, and that click
   * tore the Webhooks view straight back down.
   */
  function flowTabFromUrl() {
    const hash = window.location.hash

    if (hash === FLOW_TAB_HASHES.runs) {
      return "runs"
    }

    if (hash) {
      // Someone else's hash - another module owns what is on screen.
      return null
    }

    const segments = window.location.pathname.split("/").filter(Boolean)

    if (segments[segments.length - 1] === "reviews") {
      return "reviews"
    }

    return null
  }

  function rememberTabInUrl(value) {
    const base = flowTabsBasePath()

    if (!base) {
      return
    }

    const search = window.location.search
    let url = base + search

    if (value === "reviews") {
      url = base + "/reviews" + search
    } else if (FLOW_TAB_HASHES[value]) {
      url = base + search + FLOW_TAB_HASHES[value]
    }

    const current =
      window.location.pathname + window.location.search + window.location.hash

    if (url !== current) {
      // replaceState rather than pushState: a refresh keeps your tab, but the
      // back button skips past tab switches instead of trapping the user in
      // them. Amplience's router does not listen for raw History API calls,
      // so this corrects the URL without provoking a re-render.
      history.replaceState(history.state, "", url)
    }

    // The user's click is the authority now, so this URL needs no restoring.
    reconciledUrl = urlKey()
  }

  function handleFlowTabClick(event) {
    if (!stylesEnabled || !isFlowsListingPath()) {
      return
    }

    const target = event.target

    if (!target || typeof target.closest !== "function") {
      return
    }

    const tab = target.closest('[role="tab"]')

    if (!tab) {
      return
    }

    // Only Amplience's own three tabs. A tab injected by another module - the
    // flows-webhooks "Webhooks" tab, which owns #webhooks - has no
    // `-tab-<value>` id and is deliberately left alone.
    const value = flowTabValueFromElement(tab)

    if (!value) {
      return
    }

    rememberTabInUrl(value)
    endTabClick()
  }

  function urlKey() {
    return window.location.pathname + window.location.hash
  }

  /*
   * A tab click is not over when it starts. React commits the switch, and
   * flows-webhooks may clear its #webhooks hash from its own capture-phase
   * listener - both before this module's bubble-phase listener writes the
   * URL, measured at ~200ms later. That middle window is where a restore
   * would read a URL nobody has reconciled yet and drag the user back to the
   * tab they just left. So restore is suppressed from the moment a tab click
   * is seen until the URL for it has been written.
   */
  function beginTabClick() {
    tabClickInFlight = true
    clearTimeout(tabClickRelease)

    // Backstop: if the bubble-phase handler never runs - another listener
    // stopped propagation - restore must not stay suppressed for good.
    tabClickRelease = setTimeout(endTabClick, 1000)
  }

  function endTabClick() {
    clearTimeout(tabClickRelease)
    tabClickRelease = null
    tabClickInFlight = false
  }

  /*
   * Restores the tab the URL asks for, ONCE per URL.
   *
   * The once-per-URL guard is load-bearing, not an optimisation. This runs
   * from the body observer, and a MutationObserver callback is a microtask:
   * on a real user click, React commits the tab switch and this fires BEFORE
   * the click event finishes bubbling to our own listener (measured at ~230ms
   * ahead of it). So it would read the URL of the tab the user had just left
   * and click straight back to it - the content snapped back while the URL
   * moved on, and the user had to click twice.
   *
   * Tracking the last URL we reconciled removes the race entirely rather than
   * papering over the timing: rememberTabInUrl() marks the URL it writes as
   * reconciled, so a stale URL can never pull the user backwards.
   */
  function restoreTabFromUrl() {
    if (!stylesEnabled || !isFlowsListingPath() || tabClickInFlight) {
      return
    }

    const key = urlKey()

    if (reconciledUrl === key) {
      return
    }

    const value = flowTabFromUrl()

    if (!value) {
      reconciledUrl = key
      return
    }

    const tab = getFlowTab(value)

    if (!tab) {
      // Tab bar has not rendered yet - leave the URL unreconciled so the
      // observer brings us back once it has.
      return
    }

    reconciledUrl = key

    if (tab.getAttribute("data-active") !== "true") {
      tab.click()
    }
  }

  /*
   * Only raises the suppression flag - it deliberately does NOT write the
   * URL. Capture runs before flows-webhooks clears its hash and before React
   * commits, which is exactly when the flag needs to be up.
   */
  function markTabClickStarted(event) {
    if (!stylesEnabled || !isFlowsListingPath()) {
      return
    }

    const target = event.target

    if (!target || typeof target.closest !== "function") {
      return
    }

    const tab = target.closest('[role="tab"]')

    // Ignores another module's injected tab, so clicking Webhooks never
    // suppresses anything.
    if (!tab || !flowTabValueFromElement(tab)) {
      return
    }

    beginTabClick()
  }

  document.addEventListener("click", markTabClickStarted, true)

  /*
   * The URL write stays in the BUBBLE phase on purpose. flows-webhooks clears
   * the hash from a capture-phase listener on the same clicks, so writing the
   * URL from capture here could see it wiped immediately afterwards.
   * Bubbling puts this last, so the URL it writes wins.
   */
  document.addEventListener("click", handleFlowTabClick)
  window.addEventListener("hashchange", restoreTabFromUrl)
  window.addEventListener("popstate", restoreTabFromUrl)

  function applyStylesSetting(enabled) {
    stylesEnabled = Boolean(enabled)

    if (enabled) {
      document.documentElement.setAttribute(
        "data-amplience-style-patches",
        "enabled",
      )

      insertWorkforceLink()
      startPatchObserver()
      restoreTabFromUrl()
      return
    }

    document.documentElement.removeAttribute("data-amplience-style-patches")
    stopPatchObserver()
    removeWorkforceLink()
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    applyStylesSetting(settings.stylesEnabled)
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.stylesEnabled) {
      return
    }

    applyStylesSetting(Boolean(changes.stylesEnabled.newValue))
  })
})()
