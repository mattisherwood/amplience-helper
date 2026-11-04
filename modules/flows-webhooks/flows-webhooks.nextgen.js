// Flows Webhooks - new UI (nextgen.amplience.net / unifiedapp.amplience.net)
//
// Separate from flows-webhooks.js on purpose (same reasoning as
// flows-migration.nextgen.js): that file targets the classic Workforce app's
// /content-studio/<hubId>/content-flows routes, whereas the new UI is a
// React/Mantine app with /:orgName/flows/:hubName routes and a different tab
// bar. The data, masking and list rendering are shared via
// flows-webhooks.core.js, so this file only deals with routes, hub lookup,
// and where the tab and panel go.
//
// Adds:
//   - a "Webhooks" tab to the flows workbench, pinned after Flows and Runs
//   - an "Open Webhooks tab" button under the Webhook field of a flow's
//     Webhook Trigger, like the classic editor's "Open Webhook Library" - a
//     shortcut to the tab, which leaves the flow open in the workbench
//   - a "Webhooks" link under Settings > Automation (after AI models and
//     Skills) that opens that tab. There's no settings page of its own - the
//     tab is the one place the list lives.
//
// How the new UI's tab bar differs from the classic one (verified 2026-11-04):
//   - It's a workbench in the app header: pinned "library" tabs (Flows, Runs)
//     followed by a closeable tab per open flow. The pinned tabs stay put
//     while a flow is open, so the Webhooks tab is reachable from inside the
//     flow editor too - the classic app has no tab bar there.
//   - Every native tab is a route: /flows/:hub, /flows/:hub/runs,
//     /flows/:hub/:flowId. Anything else after the hub is taken as a flow ID
//     (/flows/:hub/webhooks opens a broken "Flow" tab), so this tab can't
//     have a path of its own. It's driven by a #webhooks hash on whatever
//     route is current instead.
//   - The tab list is portalled into the header, outside the Tabs root that
//     holds the panels, so tab and panel are found separately.
//   - Inactive panels are emptied as well as hidden. Hiding the active one
//     with CSS (never touching React's inline styles) keeps an open flow
//     editor mounted, unsaved changes and all, while Webhooks is showing.

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

  // Same <html> attributes as the classic host, so the shared stylesheet
  // works unchanged. ENABLED_ATTRIBUTE gates every rule; VIEW_ATTRIBUTE is
  // only present while our tab is the one showing.
  const ENABLED_ATTRIBUTE = "data-amplience-flows-webhooks"
  const VIEW_ATTRIBUTE = "data-amplience-webhooks-view"

  const TAB_ID = "flows-webhooks-tab"
  const PANEL_ID = "flows-webhooks-panel"
  const UNIT_ATTRIBUTE = "data-amplience-flows-webhooks-tab"
  const WAS_ACTIVE_ATTRIBUTE = "data-amplience-was-active"
  const TAB_LABEL = "Webhooks"
  const HASH = "#webhooks"

  const SYNC_DEBOUNCE = 150

  /*
   * Selectors. Mantine builds tab and panel ids as `mantine-<uid>-tab-<value>`
   * and `mantine-<uid>-panel-<value>`, where <value> is the app's own tab
   * key - far steadier than the hashed CSS-module classes on the same
   * elements. If any of these stop matching, the tab simply doesn't appear
   * and the page behaves exactly as Amplience ships it.
   */
  // The pinned Flows tab. Its tablist is the workbench tab bar.
  const LIBRARY_TAB = '[role="tab"][id$="-tab-flows-library"]'
  // The pinned Runs tab - the preferred template to clone, as it's the tab
  // ours sits next to.
  const RUNS_TAB = '[role="tab"][id$="-tab-flow-runs-library"]'
  // The Flows panel. Always mounted (empty when inactive), and its parent is
  // the Tabs root our panel joins.
  const LIBRARY_PANEL = '[id$="-panel-flows-library"]'
  // Close buttons on open-flow tabs. A click on one closes that flow; it
  // isn't a request to leave the Webhooks view.
  const CLOSE_BUTTON = '.mantine-CloseButton-root, [aria-label^="Close "]'

  // Tabler stroke-width 2, matching the new UI's own tab icons.
  const ICON_CLASS = "tabler-icon tabler-icon-webhook"

  /*
   * Settings side nav. The Automation group's links (AI models, Skills) point
   * at /:org/flows/:cmsHub/settings/<page>, on every settings page that shows
   * the group - the flows hub's own, the content and assets ones, and the
   * org-level ones - so their hrefs both find the group and tell us which
   * flows hub to link to. Matched by href rather than by the "Automation"
   * heading or the hashed `_link_*` classes.
   */
  const AUTOMATION_LINKS =
    'a[href*="/flows/"][href$="/settings/ai-models"], a[href*="/flows/"][href$="/settings/skills"]'
  const SETTINGS_LINK_ID = "flows-webhooks-settings-link"

  /*
   * The Webhook Trigger's config form is generated from the action's JSON
   * schema, and each input carries a `schemalocation` pointing back at its
   * property - for this field, .../properties/amp:webhookId (verified
   * 2026-11-04). That's far steadier than the label text or hashed classes.
   * If it stops matching, the button just doesn't appear.
   */
  const WEBHOOK_FIELD_INPUT = 'input[schemalocation$="/properties/amp:webhookId"]'
  const SHORTCUT_CLASS = "awh-webhook-shortcut"
  // The Select keeps the chosen listener's GraphQL ID in a hidden input
  // beside the field. Those IDs start "V2ViaG9va0xpc3RlbmVy" - base64 for
  // "WebhookListener" - which is how we tell it from any other hidden input.
  const LISTENER_ID_PREFIX = "V2ViaG9va0xpc3RlbmVy"
  // If the in-app navigation hasn't rendered the flows workbench by now, fall
  // back to loading the URL properly.
  const SETTINGS_NAV_FALLBACK = 3000

  let enabled = false
  let viewActive = false
  let syncTimeout = null
  let pageObserver = null

  // Set to the URL at the moment the user clicks another workbench tab, and
  // cleared as soon as the URL moves on. While it's set, a #webhooks still
  // in the URL is stale - React is navigating away - so the sync mustn't
  // bring the view back. See handleNativeTabClick.
  let leavingFrom = null

  const panel = core.createPanel({
    id: PANEL_ID,
    role: "tabpanel",
    title: TAB_LABEL,
    getHubId: function () {
      const route = getRoute()

      if (!route) {
        throw new Error("Could not work out which hub this is.")
      }

      return core.resolveCmsHubId(route.orgName, route.hubName)
    },
  })

  panel.element.setAttribute("aria-labelledby", TAB_ID)
  panel.element.removeAttribute("aria-label")

  /* ---------------------------------------------------------------- routing */

  /*
   * The workbench tab bar shows on every flows route except settings:
   *   /:org/flows/:hub                -> Flows
   *   /:org/flows/:hub/runs[/...]     -> Runs
   *   /:org/flows/:hub/:flowId        -> an open flow
   *   /:org/flows/:hub/settings/...   -> no tab bar (returns null)
   */
  function getRoute() {
    const segments = window.location.pathname
      .split("/")
      .filter(Boolean)
      .map(function (segment) {
        try {
          return decodeURIComponent(segment)
        } catch (error) {
          return segment
        }
      })

    const orgName = segments[0]
    const area = segments[1]
    const hubName = segments[2]
    const section = segments[3]

    if (area !== "flows" || !orgName || !hubName || section === "settings") {
      return null
    }

    return { orgName: orgName, hubName: hubName }
  }

  /* ------------------------------------------------------------------- DOM  */

  function getTabList() {
    const library = document.querySelector(LIBRARY_TAB)
    return library ? library.closest('[role="tablist"]') : null
  }

  function getPanelsRoot() {
    const libraryPanel = document.querySelector(LIBRARY_PANEL)
    return libraryPanel ? libraryPanel.parentElement : null
  }

  function getNativeTabs(list) {
    const tabList = list || getTabList()

    if (!tabList) {
      return []
    }

    return Array.prototype.filter.call(
      tabList.querySelectorAll('[role="tab"]'),
      function (tab) {
        return tab.id !== TAB_ID
      },
    )
  }

  /*
   * Each native tab sits inside wrapper elements (an animated wrapper div and
   * a span, today) inside a "pinned tabs" group. The unit to clone is the
   * template's outermost ancestor that holds no other tab, and it goes into
   * the parent that does - i.e. alongside the real Flows and Runs wrappers.
   * Worked out structurally rather than by the hashed `_tabWrapper` /
   * `_pinnedTabs` classes, so a restyle doesn't lose the tab.
   */
  function getPlacement(template, list) {
    let node = template

    while (node.parentElement && node.parentElement !== list) {
      if (node.parentElement.querySelectorAll('[role="tab"]').length > 1) {
        return { container: node.parentElement, unit: node }
      }
      node = node.parentElement
    }

    return { container: list, unit: node }
  }

  // Swaps the template's label text for ours wherever it appears - a text
  // node, or a `data-label` attribute (the new UI uses one to reserve the
  // bold label's width so tabs don't shift when they become active).
  function relabel(root, from, to) {
    let replaced = false

    Array.prototype.forEach.call(
      root.querySelectorAll("[data-label]"),
      function (el) {
        el.setAttribute("data-label", to)
      },
    )

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()

    while (node) {
      if (from && node.nodeValue.trim() === from) {
        node.nodeValue = to
        replaced = true
      }
      node = walker.nextNode()
    }

    return replaced
  }

  /*
   * Cloning a real tab is deliberate, as in the classic host: the clone
   * inherits Amplience's current hashed classes, so it keeps matching the
   * genuine tabs through restyles. React doesn't know the clone exists - it
   * has no fiber - and our click handler stops the event before it reaches
   * React's root listener.
   */
  function buildTab(placement, template) {
    const unit = placement.unit.cloneNode(true)
    const tab =
      placement.unit === template
        ? unit
        : unit.querySelector('[role="tab"]') || unit

    const fromLabel =
      template.getAttribute("aria-label") || template.textContent.trim()

    unit.setAttribute(UNIT_ATTRIBUTE, "true")
    tab.id = TAB_ID
    tab.setAttribute("aria-controls", PANEL_ID)
    tab.setAttribute("aria-label", TAB_LABEL)
    tab.setAttribute("aria-selected", "false")
    tab.setAttribute("tabindex", "-1")
    tab.setAttribute("data-amplience-injected", "true")
    tab.removeAttribute("data-testid")
    tab.removeAttribute("data-active")
    tab.removeAttribute("aria-keyshortcuts")
    tab.removeAttribute(WAS_ACTIVE_ATTRIBUTE)

    if (!relabel(tab, fromLabel, TAB_LABEL)) {
      tab.textContent = TAB_LABEL
    }

    // Replace the template's Tabler icon in place, keeping the slot (and so
    // the native sizing) it sits in. Only ever writes our own static SVG.
    const icon = tab.querySelector("svg")

    if (icon) {
      const holder = document.createElement("span")
      holder.innerHTML = core.tabIconSvg({
        size: 24,
        strokeWidth: 2,
        className: ICON_CLASS,
      })
      icon.replaceWith(holder.firstChild)
    }

    tab.addEventListener("click", function (event) {
      event.preventDefault()
      event.stopPropagation()
      showWebhooks()
    })

    return unit
  }

  function getInjectedUnit() {
    return document.querySelector("[" + UNIT_ATTRIBUTE + "]")
  }

  function removeUi() {
    const unit = getInjectedUnit()

    if (unit) {
      unit.remove()
    }

    panel.element.remove()
    removeFieldShortcuts()

    // An open create/edit dialog belongs to the panel; don't leave it behind.
    if (core.closeEditor) {
      core.closeEditor()
    }
  }

  /* ------------------------------------------- webhook field shortcut ---- */

  function getWebhookFields() {
    return Array.prototype.map.call(
      document.querySelectorAll(WEBHOOK_FIELD_INPUT),
      function (input) {
        return input.closest(".mantine-InputWrapper-root") || input.parentElement
      },
    )
  }

  // The hook currently chosen in the field, so the tab can point at it.
  function selectedListenerId(field) {
    const scope = field.parentElement || field
    const hidden = Array.prototype.find.call(
      scope.querySelectorAll('input[type="hidden"]'),
      function (input) {
        return input.value.indexOf(LISTENER_ID_PREFIX) === 0
      },
    )

    return hidden ? hidden.value : null
  }

  function buildShortcut(field) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "awh-button awh-button-default " + SHORTCUT_CLASS
    button.innerHTML = core.tabIconSvg({ size: 16, strokeWidth: 2 })
    button.appendChild(document.createTextNode("Open Webhooks tab"))
    button.title = "See, copy and manage this hub's webhook URLs"

    button.addEventListener("click", function (event) {
      event.preventDefault()
      event.stopPropagation()

      const id = selectedListenerId(field)
      showWebhooks()

      if (id) {
        panel.highlight(id)
      }
    })

    // Remember which field it belongs to, so a re-rendered form doesn't
    // leave it stranded or get a second one.
    button.awhField = field
    field.awhShortcut = button
    return button
  }

  /*
   * Placed straight after the field. The field sits in the form's
   * SimpleGrid, so the button becomes a grid item and picks up the form's
   * own spacing, just below the Webhook select - where the classic editor
   * has its "Open Webhook Library" button.
   */
  function syncFieldShortcuts() {
    Array.prototype.forEach.call(
      document.querySelectorAll("." + SHORTCUT_CLASS),
      function (button) {
        if (!button.awhField || !button.awhField.isConnected) {
          button.remove()
        }
      },
    )

    getWebhookFields().forEach(function (field) {
      if (!field.awhShortcut || !field.awhShortcut.isConnected) {
        field.after(buildShortcut(field))
      }
    })
  }

  function shortcutsNeedSync() {
    return (
      getWebhookFields().some(function (field) {
        return !field.awhShortcut || !field.awhShortcut.isConnected
      }) ||
      Array.prototype.some.call(
        document.querySelectorAll("." + SHORTCUT_CLASS),
        function (button) {
          return !button.awhField || !button.awhField.isConnected
        },
      )
    )
  }

  function removeFieldShortcuts() {
    Array.prototype.forEach.call(
      document.querySelectorAll("." + SHORTCUT_CLASS),
      function (button) {
        if (button.awhField) {
          button.awhField.awhShortcut = null
        }
        button.remove()
      },
    )
  }

  /* ---------------------------------------------------- settings link ---- */

  // The Automation group's native links. The link we clone is a non-active
  // one where possible, so it doesn't carry the active styling or the
  // highlight element (which has a view-transition-name that must stay
  // unique on the page).
  function getAutomationTemplate() {
    const links = Array.prototype.filter.call(
      document.querySelectorAll(AUTOMATION_LINKS),
      function (link) {
        return link.id !== SETTINGS_LINK_ID
      },
    )

    if (!links.length) {
      return null
    }

    const inactive = links.filter(function (link) {
      return !link.hasAttribute("aria-current")
    })

    return {
      template: inactive[inactive.length - 1] || links[links.length - 1],
      // Ours goes after the group's last link.
      last: links[links.length - 1],
    }
  }

  // /:org/flows/:hub/settings/skills -> /:org/flows/:hub#webhooks
  function webhooksUrlFrom(link) {
    const path = link.getAttribute("href") || ""
    const base = path.replace(/\/settings\/[^/]+\/?$/, "")

    return base && base !== path ? base + HASH : null
  }

  /*
   * In-app navigation, so the app doesn't reload. The cloned link has no
   * React Router handler of its own, so we do what the router does on Back:
   * set the URL, then fire popstate - the router reads window.location and
   * renders that route. Our own sync then sees #webhooks on a workbench
   * route and opens the tab.
   *
   * If the router ignores it (a future change to how it listens), the URL
   * has already changed but the page hasn't, so reload it as a full page
   * load after a moment rather than leaving the user stranded.
   */
  function openWebhooksFromSettings(url) {
    history.pushState(history.state, "", url)
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: history.state }),
    )

    setTimeout(function () {
      const target = new URL(url, window.location.href)

      if (
        window.location.pathname === target.pathname &&
        !document.querySelector(LIBRARY_TAB)
      ) {
        window.location.reload()
      }
    }, SETTINGS_NAV_FALLBACK)
  }

  function buildSettingsLink(template, url) {
    const link = template.cloneNode(true)

    link.id = SETTINGS_LINK_ID
    link.setAttribute("href", url)
    link.setAttribute("data-amplience-injected", "true")
    link.removeAttribute("aria-current")
    link.removeAttribute("data-discover")
    link.removeAttribute("data-testid")

    // Active-state leftovers, in case the only template was the active link:
    // the hashed `_linkActive_*` class and the animated highlight element.
    Array.prototype.slice.call(link.classList).forEach(function (name) {
      if (/active/i.test(name)) {
        link.classList.remove(name)
      }
    })
    Array.prototype.forEach.call(
      link.querySelectorAll('[style*="view-transition-name"]'),
      function (el) {
        el.remove()
      },
    )

    const fromLabel = template.textContent.trim()

    if (!relabel(link, fromLabel, TAB_LABEL)) {
      link.textContent = TAB_LABEL
    }

    // Swap the icon's paths but keep the svg element and its sizing
    // attributes, which the side nav sets with CSS variables.
    const icon = link.querySelector("svg")

    if (icon) {
      const holder = document.createElement("span")
      holder.innerHTML = core.tabIconSvg({ strokeWidth: 2 })
      icon.innerHTML = holder.firstChild.innerHTML
      icon.setAttribute("class", ICON_CLASS)
    }

    link.addEventListener("click", function (event) {
      // Leave cmd/ctrl/shift/middle-clicks to the browser - the href is a
      // real URL, so "open in new tab" works as normal.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      openWebhooksFromSettings(url)
    })

    return link
  }

  function removeSettingsLink() {
    const link = document.getElementById(SETTINGS_LINK_ID)

    if (link) {
      link.remove()
    }
  }

  function syncSettingsLink() {
    const found = getAutomationTemplate()
    const existing = document.getElementById(SETTINGS_LINK_ID)

    if (!found) {
      if (existing) {
        existing.remove()
      }
      return
    }

    const url = webhooksUrlFrom(found.template)

    if (!url) {
      return
    }

    // Already in place for this hub - nothing to do.
    if (
      existing &&
      existing.getAttribute("href") === url &&
      existing.parentNode === found.last.parentNode
    ) {
      return
    }

    if (existing) {
      existing.remove()
    }

    found.last.after(buildSettingsLink(found.template, url))
  }

  /* ---------------------------------------------------------- view activation */

  /*
   * Mantine paints the active tab from data-active (and screen readers go by
   * aria-selected). While our view shows, we take both off whichever native
   * tab holds them and put them back afterwards - otherwise the bar shows two
   * active tabs. React only rewrites these when the tab's own active state
   * changes (a route change), and the sync below re-applies this when it does.
   */
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

    const natives = getNativeTabs()

    if (active) {
      const current = natives.filter(function (native) {
        return native.getAttribute("data-active") === "true"
      })

      if (!current.length) {
        return
      }

      // A route change moved React's active tab - forget the old one.
      natives.forEach(function (native) {
        native.removeAttribute(WAS_ACTIVE_ATTRIBUTE)
      })

      current.forEach(function (native) {
        native.setAttribute(WAS_ACTIVE_ATTRIBUTE, "true")
        native.removeAttribute("data-active")
        native.setAttribute("aria-selected", "false")
      })
    } else {
      natives.forEach(function (native) {
        if (native.getAttribute(WAS_ACTIVE_ATTRIBUTE) === "true") {
          native.removeAttribute(WAS_ACTIVE_ATTRIBUTE)
          native.setAttribute("data-active", "true")
          native.setAttribute("aria-selected", "true")
        }
      })
    }
  }

  // Idempotent: the sync calls this every time the URL says #webhooks.
  function activateView() {
    viewActive = true
    document.documentElement.setAttribute(VIEW_ATTRIBUTE, "active")
    markTabActive(true)
    panel.load(false)
  }

  function deactivateView() {
    viewActive = false
    document.documentElement.removeAttribute(VIEW_ATTRIBUTE)
    markTabActive(false)
    panel.remask()
  }

  /*
   * The URL is the source of truth: #webhooks on a workbench route means
   * "show Webhooks". Our tab adds the hash with pushState, so the back button
   * returns to whatever tab was showing.
   *
   * pushState rather than `location.hash =`: a hash assignment fires
   * popstate, which React Router would handle as a navigation of its own and
   * record a history entry without its index state. pushState with the
   * router's current state object leaves the router entirely undisturbed.
   */
  function showWebhooks() {
    if (!enabled || !getRoute()) {
      return
    }

    leavingFrom = null

    if (window.location.hash !== HASH) {
      history.pushState(
        history.state,
        "",
        window.location.pathname + window.location.search + HASH,
      )
    }

    activateView()
  }

  function clearHash() {
    if (window.location.hash === HASH) {
      history.replaceState(
        history.state,
        "",
        window.location.pathname + window.location.search,
      )
    }
  }

  /*
   * A click on any other workbench tab leaves the Webhooks view. Capture
   * phase, so it runs before React's handler and our panel is already out
   * of the way when the clicked tab's route renders.
   *
   * What happens to the #webhooks entry depends on the tab (verified
   * 2026-11-04):
   *   - Another route's tab (Runs from Flows, say): React pushes that route,
   *     so the #webhooks entry is left in history as it is, and Back returns
   *     to Webhooks - better than the classic tab, where Back can't.
   *   - The tab of the route we're already on (the one we marked
   *     was-active): React does nothing at all, since that tab is already its
   *     current value, so we drop the hash ourselves with replaceState.
   */
  function handleNativeTabClick(event) {
    if (!enabled || !viewActive) {
      return
    }

    const target = event.target

    if (!target || typeof target.closest !== "function") {
      return
    }

    const tab = target.closest('[role="tab"]')
    const list = getTabList()

    if (!tab || tab.id === TAB_ID || !list || !list.contains(tab)) {
      return
    }

    // Closing a flow isn't leaving Webhooks. If it was the flow whose route
    // we're on, React navigates elsewhere, the hash goes with it, and the
    // sync deactivates us then.
    if (target.closest(CLOSE_BUTTON)) {
      return
    }

    const sameRoute = tab.getAttribute(WAS_ACTIVE_ATTRIBUTE) === "true"

    deactivateView()

    if (sameRoute) {
      clearHash()
    } else {
      leavingFrom = window.location.href
    }
  }

  /*
   * Reconciles the page to the state it should be in, the same declarative
   * approach as the classic host. Every trigger - page load, router
   * navigation, back/forward, React re-rendering the header - lands here,
   * and the only questions are "should the tab be on the page, is it, and
   * does the URL say Webhooks is showing?".
   */
  function syncUi() {
    if (!enabled) {
      return
    }

    syncSettingsLink()

    if (!getRoute()) {
      if (viewActive) {
        deactivateView()
      }

      if (getInjectedUnit() || panel.element.isConnected) {
        removeUi()
      }
      return
    }

    // Only a workbench route has a flow editor, so only here can there be a
    // Webhook Trigger field to add the shortcut to.
    syncFieldShortcuts()

    const list = getTabList()
    const template =
      document.querySelector(RUNS_TAB) || document.querySelector(LIBRARY_TAB)
    const root = getPanelsRoot()

    if (!list || !template || !root) {
      // The workbench hasn't rendered yet. The page observer calls us again
      // as soon as it does, so there's nothing to retry and nothing to time
      // out.
      return
    }

    if (!document.getElementById(TAB_ID)) {
      const placement = getPlacement(template, list)
      placement.container.appendChild(buildTab(placement, template))
    }

    // The same panel element every time - re-attaching it after a React
    // remount keeps the fetched list and any expanded schema.
    if (panel.element.parentNode !== root) {
      root.appendChild(panel.element)
    }

    if (leavingFrom && leavingFrom !== window.location.href) {
      leavingFrom = null
    }

    if (window.location.hash === HASH && !leavingFrom) {
      activateView()
    } else if (viewActive) {
      deactivateView()
    }
  }

  function scheduleSync() {
    clearTimeout(syncTimeout)
    syncTimeout = setTimeout(syncUi, SYNC_DEBOUNCE)
  }

  // Cheap checks for whether the page and the wanted state disagree, so a
  // busy page only pays for a sync when there's something to fix.
  function needsSync() {
    const tabPresent = Boolean(document.getElementById(TAB_ID))

    // The settings link: wanted wherever the Automation group is rendered.
    if (
      Boolean(document.querySelector(AUTOMATION_LINKS)) !==
      Boolean(document.getElementById(SETTINGS_LINK_ID))
    ) {
      return true
    }

    if (!getRoute()) {
      return tabPresent || panel.element.isConnected
    }

    if (!tabPresent || !panel.element.isConnected) {
      return true
    }

    if (shortcutsNeedSync()) {
      return true
    }

    if (leavingFrom && leavingFrom !== window.location.href) {
      return true
    }

    if (viewActive !== (window.location.hash === HASH && !leavingFrom)) {
      return true
    }

    return (
      viewActive &&
      getNativeTabs().some(function (native) {
        return native.getAttribute("data-active") === "true"
      })
    )
  }

  /*
   * One observer on <body>. It's what makes the tab appear when the user
   * arrives at Flows client-side (from the icon bar, say), where there's no
   * tab bar to observe yet, and what puts it back when React remounts the
   * header. Debounced, and gated on needsSync().
   */
  function startObserving() {
    if (pageObserver) {
      return
    }

    pageObserver = new MutationObserver(function () {
      if (enabled && needsSync()) {
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

  /* ------------------------------------------------------------- lifecycle  */

  function start() {
    document.documentElement.setAttribute(ENABLED_ATTRIBUTE, "enabled")
    startObserving()
    syncUi()
  }

  function stop() {
    clearTimeout(syncTimeout)
    stopObserving()
    leavingFrom = null
    deactivateView()
    clearHash()
    removeUi()
    removeSettingsLink()
    document.documentElement.removeAttribute(ENABLED_ATTRIBUTE)
    panel.resetCache()
  }

  // The fast path for route changes; the observer catches anything these
  // miss, such as a router holding its own reference to history.pushState.
  function hookNavigation() {
    ;["pushState", "replaceState"].forEach(function (method) {
      const original = history[method]

      history[method] = function () {
        const result = original.apply(history, arguments)
        scheduleSync()
        return result
      }
    })

    window.addEventListener("popstate", scheduleSync)
    window.addEventListener("hashchange", scheduleSync)
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
