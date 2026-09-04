;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    flowsWebhooksEnabled: false,
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
  const REVEAL_TIMEOUT = 30000 // re-mask a revealed URL after 30s

  let enabled = false
  let viewActive = false
  let syncTimeout = null
  let pageObserver = null
  let lastHubId = null
  let cache = null // { hubId, items }
  let fetchInFlight = false
  const revealTimers = new Map()

  /*
   * The official webhook mark - three nodes joined by arcs. The arc geometry
   * is Tabler's `webhook` icon (same 24px grid as the icons Amplience puts on
   * Flows/Runs/Reviews); the three filled circles sit at the arc centres,
   * which is what the official logo has and Tabler's outline version leaves
   * out.
   *
   * Drawn at stroke-width 1.5 to match the weight of Amplience's own tab
   * icons rather than the logo's heavier lockup, and with currentColor
   * instead of their hardcoded #002C42 so it stays visible in dark mode.
   */
  const ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M4.876 13.61a4 4 0 1 0 6.124 3.39h6"></path>' +
    '<path d="M15.066 20.502a4 4 0 1 0 1.934 -7.502c-.706 0 -1.424 .179 -2 .5l-3 -5.5"></path>' +
    '<path d="M16 8a4 4 0 1 0 -8 0c0 1.506 .77 2.818 2 3.5l-3 5.5"></path>' +
    '<circle cx="12" cy="8" r="1.7" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="7" cy="17" r="1.7" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="17" cy="17" r="1.7" fill="currentColor" stroke="none"></circle>' +
    "</svg>"

  function log() {
    const args = Array.prototype.slice.call(arguments)
    console.debug.apply(
      console,
      ["[Amplience Helper] flows-webhooks:"].concat(args),
    )
  }

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

  /* ------------------------------------------------------------------- data */

  // Same Auth0 SPA storage the flows-migration module reads. Amplience keeps
  // the access token under a key prefixed @@auth0spajs@@; no token means the
  // session has expired and we surface that inline rather than throwing.
  function extractJwtFromAuth0Storage() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("@@auth0spajs@@")) {
        try {
          const authData = JSON.parse(localStorage.getItem(key))
          if (authData && authData.body && authData.body.access_token) {
            return authData.body.access_token
          }
        } catch (error) {
          // Ignore parse errors and keep looking
        }
      }
    }
    return null
  }

  const WEBHOOKS_QUERY = [
    "query getWebhooks($hubId: ID!) {",
    "  cmsHub(id: $hubId) {",
    "    webhookListeners {",
    "      edges {",
    "        node {",
    "          id",
    "          label",
    "          schema",
    "          security {",
    "            __typename",
    "          }",
    "          url",
    "        }",
    "      }",
    "    }",
    "  }",
    "}",
  ].join("\n")

  async function fetchWebhooks(hubId) {
    const token = extractJwtFromAuth0Storage()

    if (!token) {
      throw new Error("Not signed in - reload the page and try again.")
    }

    const response = await fetch("https://api.amplience.net/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        query: WEBHOOKS_QUERY,
        variables: { hubId: hubId },
      }),
    })

    if (!response.ok) {
      throw new Error("Amplience API returned " + response.status + ".")
    }

    const payload = await response.json()

    if (payload.errors && payload.errors.length) {
      throw new Error(
        payload.errors[0].message || "The API rejected the query.",
      )
    }

    const edges =
      payload.data &&
      payload.data.cmsHub &&
      payload.data.cmsHub.webhookListeners &&
      payload.data.cmsHub.webhookListeners.edges

    if (!Array.isArray(edges)) {
      throw new Error("No webhook data came back for this hub.")
    }

    return edges
      .map(function (edge) {
        return edge && edge.node
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return String(a.label || "").localeCompare(String(b.label || ""))
      })
  }

  /* --------------------------------------------------------------- helpers  */

  // The hook URL is effectively the credential, so the list shows a masked
  // form by default: origin, first path segment, and the last four characters
  // so a row is still identifiable when someone reads it out.
  function maskUrl(url) {
    if (typeof url !== "string" || !url) {
      return "—"
    }

    const tail = url.slice(-4)

    try {
      const parsed = new URL(url)
      const firstSegment = parsed.pathname.split("/").filter(Boolean)[0]
      return (
        parsed.origin +
        (firstSegment ? "/" + firstSegment : "") +
        "/…••••" +
        tail
      )
    } catch (error) {
      return url.slice(0, 28) + "…••••" + tail
    }
  }

  // security.__typename comes back as e.g. WebhookListenerSecurityNone.
  function securityLabel(security) {
    const typename = security && security.__typename

    if (!typename) {
      return "Unknown"
    }

    const stripped = typename.replace(/^WebhookListenerSecurity/, "")

    if (!stripped) {
      return typename
    }

    return stripped.replace(/([a-z])([A-Z])/g, "$1 $2")
  }

  // schema arrives as a JSON string. Pretty-print it when it parses, show it
  // verbatim when it does not.
  function formatSchema(schema) {
    if (typeof schema !== "string" || !schema.trim()) {
      return null
    }

    try {
      const parsed = JSON.parse(schema)

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Object.keys(parsed).length === 0
      ) {
        return null
      }

      return JSON.stringify(parsed, null, 2)
    } catch (error) {
      return schema
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      // The Clipboard API needs a secure context and can be blocked by
      // permissions policy, so fall back to a throwaway textarea.
      try {
        const scratch = document.createElement("textarea")
        scratch.value = text
        scratch.setAttribute("readonly", "")
        scratch.style.position = "fixed"
        scratch.style.top = "-1000px"
        scratch.style.opacity = "0"
        document.body.appendChild(scratch)
        scratch.select()
        const copied = document.execCommand("copy")
        scratch.remove()
        return copied
      } catch (fallbackError) {
        return false
      }
    }
  }

  function button(className, text) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = className
    el.textContent = text
    return el
  }

  // Tabler-style glyphs, drawn on the same 24px grid as Amplience's own icons
  // and stroked with currentColor so they take the URL's colour.
  const ICON = {
    eye:
      '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path>' +
      '<path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"></path>',
    eyeOff:
      '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path>' +
      '<path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"></path>' +
      '<path d="M4 4l16 16"></path>',
    copy:
      '<path d="M8 10a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"></path>' +
      '<path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"></path>',
    check: '<path d="M5 12l5 5l10 -10"></path>',
    refresh:
      '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path>' +
      '<path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>',
  }

  function iconSvg(name) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      ICON[name] +
      "</svg>"
    )
  }

  // Only ever writes the module's own static SVG - never API data.
  function setIcon(el, name, label) {
    el.innerHTML = iconSvg(name)
    el.title = label
    el.setAttribute("aria-label", label)
  }

  function iconButton(className, name, label) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "awh-icon " + className
    setIcon(el, name, label)
    return el
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

  function buildPanel() {
    const panel = document.createElement("div")
    panel.id = PANEL_ID
    panel.setAttribute("role", "region")
    panel.setAttribute("aria-label", "Webhook URLs")

    const header = document.createElement("div")
    header.className = "awh-header"

    const summary = document.createElement("p")
    summary.className = "awh-summary"
    header.appendChild(summary)

    const refresh = iconButton("awh-refresh", "refresh", "Refresh")
    refresh.addEventListener("click", function () {
      cache = null
      loadData(true)
    })
    header.appendChild(refresh)

    const body = document.createElement("div")
    body.className = "awh-body"

    panel.appendChild(header)
    panel.appendChild(body)

    return panel
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
      if (
        document.getElementById(TAB_ID) ||
        document.getElementById(PANEL_ID)
      ) {
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

    // A different hub means a different set of webhooks.
    const hubId = extractHubIdFromUrl()

    if (hubId !== lastHubId) {
      lastHubId = hubId
      cache = null
    }

    let injected = false

    if (!document.getElementById(TAB_ID)) {
      list.appendChild(buildTab(template))
      injected = true
    }

    if (!document.getElementById(PANEL_ID)) {
      root.appendChild(buildPanel())
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
    const panel = document.getElementById(PANEL_ID)

    if (tab) {
      tab.remove()
    }

    if (panel) {
      panel.remove()
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

    loadData(false)
  }

  function deactivateView(clearHash) {
    viewActive = false
    document.documentElement.removeAttribute(VIEW_ATTRIBUTE)
    markTabActive(false)
    clearRevealTimers()

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

  /* -------------------------------------------------------------- rendering */

  function getBody() {
    const panel = document.getElementById(PANEL_ID)
    return panel ? panel.querySelector(".awh-body") : null
  }

  function setSummary(text) {
    const panel = document.getElementById(PANEL_ID)
    const summary = panel ? panel.querySelector(".awh-summary") : null

    if (summary) {
      summary.textContent = text
    }
  }

  function setRefreshBusy(busy) {
    const panel = document.getElementById(PANEL_ID)
    const refresh = panel ? panel.querySelector(".awh-refresh") : null

    if (refresh) {
      refresh.disabled = Boolean(busy)

      if (busy) {
        refresh.setAttribute("data-busy", "true")
      } else {
        refresh.removeAttribute("data-busy")
      }
    }
  }

  function renderMessage(className, text, retry) {
    const body = getBody()

    if (!body) {
      return
    }

    body.textContent = ""

    const message = document.createElement("div")
    message.className = "awh-message " + className
    message.textContent = text
    body.appendChild(message)

    if (retry) {
      const again = button("awh-btn", "Try again")
      again.addEventListener("click", function () {
        cache = null
        loadData(true)
      })
      message.appendChild(again)
    }
  }

  function clearRevealTimers() {
    revealTimers.forEach(function (timer) {
      clearTimeout(timer)
    })
    revealTimers.clear()

    const body = getBody()

    if (!body) {
      return
    }

    Array.prototype.forEach.call(
      body.querySelectorAll('.awh-row[data-revealed="true"]'),
      function (row) {
        hideRow(row)
      },
    )
  }

  function hideRow(row) {
    const url = row.getAttribute("data-url") || ""
    const code = row.querySelector(".awh-url")
    const toggle = row.querySelector(".awh-reveal")

    row.removeAttribute("data-revealed")

    if (code) {
      code.textContent = maskUrl(url)
    }

    if (toggle) {
      setIcon(toggle, "eye", "Reveal full URL")
      toggle.setAttribute("aria-pressed", "false")
    }

    const timer = revealTimers.get(row)

    if (timer) {
      clearTimeout(timer)
      revealTimers.delete(row)
    }
  }

  function revealRow(row) {
    const url = row.getAttribute("data-url") || ""
    const code = row.querySelector(".awh-url")
    const toggle = row.querySelector(".awh-reveal")

    row.setAttribute("data-revealed", "true")

    if (code) {
      code.textContent = url
    }

    if (toggle) {
      setIcon(toggle, "eyeOff", "Hide URL")
      toggle.setAttribute("aria-pressed", "true")
    }

    // Re-mask on a timer so a revealed URL does not sit on screen through a
    // screen-share once the user has moved on.
    revealTimers.set(
      row,
      setTimeout(function () {
        hideRow(row)
      }, REVEAL_TIMEOUT),
    )
  }

  function buildRow(webhook) {
    const url = typeof webhook.url === "string" ? webhook.url : ""
    const schema = formatSchema(webhook.schema)

    const row = document.createElement("div")
    row.className = "awh-row"
    row.setAttribute("data-url", url)

    const main = document.createElement("div")
    main.className = "awh-row-main"

    const expand = button("awh-expand", "")
    expand.setAttribute("aria-expanded", "false")
    expand.setAttribute(
      "aria-label",
      schema ? "Show payload schema" : "No payload schema",
    )
    expand.disabled = !schema
    main.appendChild(expand)

    const labels = document.createElement("div")
    labels.className = "awh-labels"

    const label = document.createElement("span")
    label.className = "awh-label"
    label.textContent = webhook.label || "(untitled)"
    labels.appendChild(label)

    // The URL and its two actions share one line so the icons read as part
    // of the URL rather than as a separate column.
    const urlRow = document.createElement("div")
    urlRow.className = "awh-url-row"

    const code = document.createElement("code")
    code.className = "awh-url"
    code.textContent = maskUrl(url)
    urlRow.appendChild(code)

    const inlineActions = document.createElement("span")
    inlineActions.className = "awh-inline-actions"

    const reveal = iconButton("awh-reveal", "eye", "Reveal full URL")
    reveal.setAttribute("aria-pressed", "false")
    reveal.disabled = !url
    reveal.addEventListener("click", function () {
      if (row.getAttribute("data-revealed") === "true") {
        hideRow(row)
      } else {
        revealRow(row)
      }
    })
    inlineActions.appendChild(reveal)

    const copy = iconButton("awh-copy", "copy", "Copy URL")
    copy.disabled = !url
    copy.addEventListener("click", async function () {
      const copied = await copyToClipboard(url)
      setIcon(
        copy,
        copied ? "check" : "copy",
        copied ? "Copied" : "Copy failed",
      )
      copy.setAttribute("data-state", copied ? "ok" : "error")
      setTimeout(function () {
        setIcon(copy, "copy", "Copy URL")
        copy.removeAttribute("data-state")
      }, 2000)
    })
    inlineActions.appendChild(copy)

    urlRow.appendChild(inlineActions)
    labels.appendChild(urlRow)

    main.appendChild(labels)

    const badge = document.createElement("span")
    const security = securityLabel(webhook.security)
    badge.className = "awh-badge"
    badge.setAttribute("data-security", security === "None" ? "none" : "set")
    badge.textContent = security
    badge.title = "Security: " + security
    main.appendChild(badge)

    row.appendChild(main)

    if (schema) {
      const schemaWrap = document.createElement("pre")
      schemaWrap.className = "awh-schema"
      schemaWrap.hidden = true

      const schemaTitle = document.createElement("h4")
      schemaTitle.textContent = "Payload Schema"
      schemaWrap.appendChild(schemaTitle)

      const schemaCode = document.createElement("code")
      schemaCode.textContent = schema
      schemaWrap.appendChild(schemaCode)

      row.appendChild(schemaWrap)

      expand.addEventListener("click", function () {
        const open = expand.getAttribute("aria-expanded") === "true"
        expand.setAttribute("aria-expanded", open ? "false" : "true")
        schemaWrap.hidden = open
      })
    }

    return row
  }

  function renderWebhooks(items) {
    const body = getBody()

    if (!body) {
      return
    }

    body.textContent = ""

    if (!items.length) {
      setSummary("No webhook URLs in this hub")
      renderMessage(
        "awh-empty",
        "This hub has no webhook URLs yet. Create one from the webhook library inside any flow.",
        false,
      )
      return
    }

    setSummary(
      items.length === 1 ? "1 webhook URL" : items.length + " webhook URLs",
    )

    // Labels the badge column. Rendered here rather than in the panel header
    // so it only appears when there are actually rows beneath it.
    const columns = document.createElement("div")
    columns.className = "awh-columns"

    const securityHeading = document.createElement("span")
    securityHeading.className = "awh-column-security"
    securityHeading.textContent = "Security"
    columns.appendChild(securityHeading)

    const list = document.createElement("div")
    list.className = "awh-list"

    items.forEach(function (webhook) {
      list.appendChild(buildRow(webhook))
    })

    body.appendChild(columns)
    body.appendChild(list)
  }

  async function loadData(force) {
    const hubId = extractHubIdFromUrl()

    if (!hubId) {
      renderMessage("awh-error", "Could not work out which hub this is.", false)
      return
    }

    if (!force && cache && cache.hubId === hubId) {
      renderWebhooks(cache.items)
      return
    }

    if (fetchInFlight) {
      return
    }

    fetchInFlight = true
    setRefreshBusy(true)
    setSummary("Loading…")
    renderMessage("awh-loading", "Fetching webhook URLs…", false)

    try {
      const items = await fetchWebhooks(hubId)
      cache = { hubId: hubId, items: items }
      renderWebhooks(items)
    } catch (error) {
      log("fetch failed", error)
      setSummary("Webhook URLs")
      renderMessage(
        "awh-error",
        error && error.message ? error.message : "Could not load webhook URLs.",
        true,
      )
    } finally {
      fetchInFlight = false
      setRefreshBusy(false)
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
    lastHubId = null
    cache = null
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
