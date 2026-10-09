// Amplience Hotkeys - Nextgen UI (nextgen.amplience.net)
//
// Separate from hotkeys.js on purpose: that file is built around the legacy
// AngularJS app (am-* components, md-dialog, the old masthead), whereas the
// nextgen UI is a React/Mantine app with real routes. Once the legacy app is
// retired, hotkeys.js can be deleted without touching this file.
//
// Every shortcut lives in the HOTKEYS table below. The keydown handler, the
// button tooltips and the "?" help overlay are all generated from it, so the
// help can't drift from what the keys actually do.
//
// Most entries are commented out until their nextgen target has been
// confirmed. To enable one, fill in its target and uncomment it.

;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    hotkeysEnabled: true,
  }

  // Set to false (or remove the log() calls) once the targets are confirmed.
  const DEBUG = true
  const log = (...args) => {
    if (DEBUG) console.log("[Amplience Helper · hotkeys]", ...args)
  }
  log("Script loaded on", window.location.pathname)

  /*
   * Page-level hotkeys are skipped while a Mantine modal is open, so they
   * can't act on the page behind it. The app keeps some modals mounted while
   * closed, so the root's presence isn't enough: a modal only counts as open
   * if its content box is actually rendered (has layout). If Mantine renames
   * the class, page hotkeys would also fire behind open modals, so check
   * this first if that ever happens.
   */
  const MODAL_CONTENT_SELECTOR = ".mantine-Modal-content"

  function isModalOpen() {
    return [...document.querySelectorAll(MODAL_CONTENT_SELECTOR)].some(
      (el) => el.getClientRects().length > 0,
    )
  }

  /* ------------------------------------------------------------ pages ---- */

  /*
   * Which page we're on, from the URL. Nextgen has real routes:
   *   /:org/content/:hub/content-items          -> listing
   *   /:org/content/:hub/content-items/:id      -> editor        (TODO: confirm route)
   *   /:org/content/:hub/content-types          -> contentTypes
   *   /:org/content/:hub/content-types/:id      -> contentTypeEditor
   *   /:org/media/:hub                          -> assets
   *   /:org/flows/:hub                          -> flows
   *   /:org/flows/:hub/runs                     -> flowRuns
   *   /:org/flows/:hub/:flowId                  -> flowEditor
   *   /:org/reviews/:hub                        -> reviews
   * Anything else only gets the global hotkeys.
   */
  function currentPage() {
    const [, area, , section, id] = window.location.pathname
      .split("/")
      .filter(Boolean)

    // Asset listing is the bare hub route; media settings and any other
    // sub-routes get global hotkeys only.
    if (area === "media") return section ? null : "assets"

    // Flows listing is the bare hub route and runs has its own. Any other
    // single segment is a flow id (the editor); settings and deeper routes
    // get global hotkeys only.
    if (area === "flows") {
      if (!section) return "flows"
      if (section === "runs") return id ? null : "flowRuns"
      if (section === "settings" || id) return null
      return "flowEditor"
    }

    // Reviews listing is the bare hub route.
    if (area === "reviews") return section ? null : "reviews"

    if (area !== "content") return null
    if (section === "content-items") return id ? "editor" : "listing"
    if (section === "content-types")
      return id ? "contentTypeEditor" : "contentTypes"
    return null
  }

  /* ---------------------------------------------------------- hotkeys ---- */

  /*
   * Entry fields:
   *   key     - KeyboardEvent.key. Single letters match either case.
   *   ctrl    - true to require Ctrl/Cmd. Without it, Ctrl/Cmd must NOT be held,
   *             so browser shortcuts like Ctrl+C still work.
   *   shift   - true/false to require/forbid Shift. Omit to ignore Shift.
   *   group   - Sub-heading in the help overlay.
   *   label   - Help overlay text, also used for the button tooltip.
   *   target  - Selector to click. Also gets a "Label (Key)" tooltip.
   *   focus   - Selector to focus instead of click (e.g. a search input).
   *   run     - Function(event) for anything that isn't a click or focus.
   *             Return false if it didn't act, so the browser default stands.
   *   preventDefault - true to block the browser default even when the
   *             target is missing or disabled (e.g. Ctrl+S shouldn't open the
   *             browser's "Save page" dialog when there's nothing to save).
   *
   * Prefer stable selectors: data-testid, aria-label or role first, then
   * Mantine's static class names (.mantine-*). Avoid the hashed CSS-module
   * classes (_name_xxxx), which change with each nextgen build.
   */
  const HOTKEYS = {
    global: [
      {
        key: "?",
        group: "Help",
        label: "Show this help overlay",
        run: showHelpOverlay,
      },
      {
        key: "F1",
        group: "Help",
        label: "Open the documentation",
        target: '[data-testid="icon-bar-external-help"]',
      },

      {
        key: "w",
        group: "Interface",
        label: "Close current tab",
        target:
          '[data-testid="article-tabs_tab:tabs_tab"][data-active="true"] > span[data-position="right"] > span',
      },

      {
        key: "0",
        group: "Navigation",
        label: "Home/Dashboard",
        target:
          '[data-testid="icon-bar"] > div:first-child > div:first-child a',
      },
      {
        key: "1",
        group: "Navigation",
        label: "Content",
        target:
          '[data-testid="icon-bar"] > div:first-child > div:nth-child(2) a',
      },
      {
        key: "2",
        group: "Navigation",
        label: "Assets",
        target:
          '[data-testid="icon-bar"] > div:first-child > div:nth-child(3) a',
      },
      {
        key: "3",
        group: "Navigation",
        label: "Content Types",
        target:
          '[data-testid="icon-bar"] > div:first-child > div:nth-child(4) a',
      },
      {
        key: "4",
        group: "Navigation",
        label: "Reviews",
        target:
          '[data-testid="icon-bar"] > div:first-child > div:nth-child(5) a',
      },
      {
        key: "5",
        group: "Navigation",
        label: "Flows",
        target:
          '[data-testid="icon-bar"] > div:first-child > div:nth-child(6) a',
      },
      {
        key: "6",
        group: "Navigation",
        label: "Settings",
        target:
          '[data-testid="icon-bar"] > div:first-child > div:nth-child(8) a',
      },
    ],

    listing: [
      {
        key: "F2",
        group: "Actions",
        label: "Rename selected item",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-edit)',
      },
      {
        key: "a",
        group: "Actions",
        label: "Assign a user to selected item(s)",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-user)',
      },
      {
        key: "c",
        group: "Actions",
        label: "Create a new content item",
        target: '[data-testid="content-items-create:button"]',
      },
      {
        key: "d",
        group: "Actions",
        label: "Duplicate selected item(s)",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-copy)',
      },
      {
        key: "e",
        group: "Actions",
        label: "Archive selected item(s)",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-archive)',
      },
      {
        key: "l",
        group: "Actions",
        label: "Localize selected item(s)",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-language)',
      },
      {
        key: "p",
        group: "Actions",
        label: "Publish selected item(s)",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-cloud-upload)',
      },
      // { key: "s", group: "Actions", label: "Sync selected item(s)", target: "TODO" },
      {
        key: "t",
        group: "Actions",
        label: "Tag selected item(s)",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-tag)',
      },
      {
        key: "u",
        group: "Actions",
        label: "Unpublish selected item(s)",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-cloud-x)',
      },
      {
        key: "+",
        group: "Actions",
        label: "Add selected item(s) to collection",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-folder-plus)',
      },
      {
        key: "Enter",
        group: "Actions",
        label: "Open selected item(s)",
        target:
          '[data-testid="resource-list-actions"] [data-testid="actions-bar"] button:has(.tabler-icon-external-link)',
      },

      // TODO: legacy F also starts "type to filter content types" mode once
      // the panel is open. Port that separately if it's still wanted.
      {
        key: "f",
        group: "Interface",
        label: "Show/hide Filters",
        target: '[data-testid="filtered-search:filters-trigger"]',
      },
      {
        key: "f",
        ctrl: true,
        group: "Interface",
        label: "Find",
        focus: '[data-testid="filtered-search:search"] input',
      },
      {
        key: "v",
        group: "Interface",
        label: "Toggle View (list / grid)",
        target:
          '.mantine-SegmentedControl-control:not([data-active="true"]) .mantine-SegmentedControl-label',
      },
      {
        key: "ArrowRight",
        group: "Interface",
        label: "Next page",
        target: '[data-testid="pagination:next"]',
      },
      {
        key: "ArrowLeft",
        group: "Interface",
        label: "Previous page",
        target: '[data-testid="pagination:previous"]',
      },

      {
        key: "a",
        ctrl: true,
        group: "Selection",
        label: "Select all items",
        target:
          '[data-variant="filled"]:not([data-checked="true"]) [aria-label="Select all rows"]',
      },
      {
        key: "Escape",
        group: "Selection",
        label: "Deselect all items",
        target: '[class^="_clear_"],[class*=" _clear_"]',
      },
    ],

    editor: [
      {
        key: "F2",
        group: "Actions",
        label: "Rename item",
        target: '[aria-label="Edit content title"]',
      },
      {
        key: "a",
        group: "Actions",
        label: "Assign a user",
        target: '[data-testid="inline:assignee"]',
      },
      // { key: "d", group: "Actions", label: "Set delivery key", target: "TODO" },
      {
        key: "e",
        group: "Actions",
        label: "Archive item",
        target: "button:has(.tabler-icon-archive)",
      },
      {
        key: "l",
        group: "Actions",
        label: "Localize item",
        target: "button:has(.tabler-icon-world)",
      },
      {
        key: "p",
        group: "Actions",
        label: "Publish item",
        target: "button:has(.tabler-icon-cloud-upload)",
      },
      {
        key: "u",
        group: "Actions",
        label: "Unpublish item",
        target: "button:has(.tabler-icon-cloud-off)",
      },
      {
        key: "s",
        ctrl: true,
        shift: false,
        group: "Actions",
        label: "Save",
        target: '[data-testid="actions-bar"] button[data-variant="primary"]',
      },
      // { key: "s", ctrl: true, shift: true, group: "Actions", label: "Save as...", target: "TODO" },
      // { key: "Escape", group: "Actions", label: "Cancel editing", target: "TODO" },
      {
        key: "h",
        group: "Interface",
        label: "Show/hide History panel",
        target: '[data-testid="icon-bar-tab-version history"]',
      },
      {
        key: "i",
        group: "Interface",
        label: "Show/hide Info (props) panel",
        target: '[data-testid="icon-bar-tab-properties"]',
      },
      {
        key: "j",
        group: "Interface",
        label: "Show/hide JSON preview panel",
        target: '[data-testid="icon-bar-tab-json preview"]',
      },
      // { key: "n", group: "Interface", label: "Show/hide Navigation panel", target: "TODO" },
      // { key: "s", group: "Interface", label: "Show/hide Scheduling panel", target: "TODO" },
      {
        key: "v",
        group: "Interface",
        label: "Show/hide Visualization panel",
        target: '[data-testid="icon-bar-tab-preview"]',
      },
    ],

    assets: [
      {
        key: "u",
        ctrl: true,
        shift: false,
        group: "Actions",
        label: "Upload",
        target: '[data-testid="asset-upload-button"]',
      },
    ],

    contentTypes: [
      {
        key: "c",
        group: "Actions",
        label: "Create a new content type",
        target: '[data-testid="actions-bar"] button[data-variant="primary"]',
      },

      {
        key: "f",
        group: "Interface",
        label: "Show/hide Filters",
        target: '[data-testid="filtered-search:filters-trigger"]',
      },
      {
        key: "f",
        ctrl: true,
        group: "Interface",
        label: "Find",
        focus: '[data-testid="filtered-search:search"] input',
      },
      {
        key: "ArrowRight",
        group: "Interface",
        label: "Next page",
        target: '[data-testid="pagination:next"]',
      },
      {
        key: "ArrowLeft",
        group: "Interface",
        label: "Previous page",
        target: '[data-testid="pagination:previous"]',
      },
    ],

    contentTypeEditor: [
      {
        key: "s",
        ctrl: true,
        group: "Actions",
        label: "Save",
        target: '[data-testid="actions-bar"] > div > button',
      },
      // { key: "Escape", group: "Actions", label: "Cancel editing and go back", target: "TODO" },
    ],

    reviews: [
      {
        key: "f",
        group: "Interface",
        label: "Show/hide Filters",
        target: '[data-testid="reviews:search:filters-trigger"]',
      },
      {
        key: "f",
        ctrl: true,
        group: "Interface",
        label: "Find",
        focus: '[data-testid="reviews:search:search"] input',
      },
    ],

    flows: [
      {
        key: "c",
        group: "Actions",
        label: "Create a new flow",
        target: '[data-testid="actions-bar"] button[data-variant="primary"]',
      },

      {
        key: "f",
        ctrl: true,
        group: "Interface",
        label: "Find",
        focus: '[data-testid="flows-library:search:search"] input',
      },
      {
        key: "v",
        group: "Interface",
        label: "Toggle View (list / grid)",
        target:
          '.mantine-SegmentedControl-control:not([data-active="true"]) .mantine-SegmentedControl-label',
      },
    ],

    flowEditor: [
      {
        key: "s",
        ctrl: true,
        shift: false,
        group: "Actions",
        label: "Save",
        target:
          '[data-testid="actions-bar"] button:has(.tabler-icon-device-floppy)',
      },
    ],

    flowRuns: [
      {
        key: "f",
        group: "Interface",
        label: "Show/hide Filters",
        target: '[data-testid="flow-runs-library:search:filters-trigger"]',
      },
      {
        key: "f",
        ctrl: true,
        group: "Interface",
        label: "Find",
        focus: '[data-testid="flow-runs-library:search:search"] input',
      },
    ],
  }

  const PAGE_TITLES = {
    global: "Any Time",
    listing: "While Listing Content",
    editor: "While Editing Content",
    contentTypes: "While Listing Content Types",
    contentTypeEditor: "While Editing Content Types",
    assets: "While Managing Assets",
    flows: "While Listing Flows",
    flowRuns: "While Listing Flow Runs",
    flowEditor: "While Editing Flows",
    reviews: "While Listing Reviews",
  }

  const KEY_NAMES = {
    ArrowRight: "→",
    ArrowLeft: "←",
    Escape: "Esc",
  }

  /* ---------------------------------------------------------- helpers ---- */

  const isCtrlOrCmd = (event) => event.ctrlKey || event.metaKey

  /*
   * Input types that never take typed text. Focus on one of these (e.g. the
   * radio a SegmentedControl label focuses when clicked) shouldn't pause
   * hotkeys. Any other input type counts as typing: text, search, number,
   * email, password, date/time and so on.
   */
  const NON_TEXT_INPUT_TYPES = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ])

  function isTypingInInput() {
    const el = document.activeElement
    if (!el) return false
    if (el.isContentEditable) return true

    const tag = el.tagName.toLowerCase()
    if (tag === "textarea" || tag === "select") return true
    if (tag === "input") return !NON_TEXT_INPUT_TYPES.has(el.type)
    return false
  }

  function isDisabled(el) {
    return (
      el.disabled ||
      el.getAttribute("aria-disabled") === "true" ||
      el.hasAttribute("data-disabled")
    )
  }

  function keyLabel(hotkey) {
    const key = KEY_NAMES[hotkey.key] || hotkey.key
    return [
      hotkey.ctrl && "Ctrl",
      hotkey.shift && "Shift",
      key.length === 1 ? key.toUpperCase() : key,
    ]
      .filter(Boolean)
      .join(" + ")
  }

  function matches(hotkey, event) {
    if (Boolean(hotkey.ctrl) !== isCtrlOrCmd(event)) return false
    if (hotkey.shift !== undefined && hotkey.shift !== event.shiftKey) {
      return false
    }

    return hotkey.key.length === 1
      ? event.key.toLowerCase() === hotkey.key.toLowerCase()
      : event.key === hotkey.key
  }

  /*
   * Runs one hotkey. Returns true if it acted, so the caller can stop the
   * browser default; a missing or disabled target leaves the key alone.
   */
  function perform(hotkey, event) {
    if (hotkey.run) return hotkey.run(event) !== false

    const selector = hotkey.target || hotkey.focus
    const el = document.querySelector(selector)
    if (!el) {
      log(`"${hotkey.label}": no element matches`, selector)
      return false
    }
    if (isDisabled(el)) {
      log(`"${hotkey.label}": target is disabled`, el)
      return false
    }

    log(`"${hotkey.label}": ${hotkey.focus ? "focusing" : "clicking"}`, el)
    if (hotkey.focus) el.focus()
    else el.click()
    return true
  }

  /* ---------------------------------------------------------- keydown ---- */

  function activeHotkeys() {
    const page = currentPage()
    const modalOpen = isModalOpen()
    const pageHotkeys = page && !modalOpen ? HOTKEYS[page] : []

    log(
      "Page:",
      page,
      "| modal open:",
      modalOpen,
      "| page hotkeys:",
      pageHotkeys.length,
    )

    return [...pageHotkeys, ...HOTKEYS.global]
  }

  function handleKeydown(event) {
    if (document.getElementById("hotkey-help-overlay")) return

    // While typing, only Ctrl/Cmd combos fire, so plain letters still type.
    const typing = isTypingInInput()
    log(
      `Keydown "${event.key}"`,
      "| typing in:",
      typing ? document.activeElement : false,
    )

    // Esc in a text field drops focus, so the page hotkeys work again
    // without reaching for the mouse. Skipped while the field has an open
    // dropdown (Mantine Select/Autocomplete/Combobox set aria-expanded), so
    // Esc closes that first. Not prevented or stopped, so an open modal
    // still gets Esc too.
    if (typing && event.key === "Escape") {
      const el = document.activeElement
      if (el.getAttribute("aria-expanded") !== "true") {
        log("Esc: blurring", el)
        el.blur()
      }
      return
    }

    for (const hotkey of activeHotkeys()) {
      if (typing && !hotkey.ctrl) continue
      if (!matches(hotkey, event)) continue

      log(`Matched "${hotkey.label}"`)
      if (perform(hotkey, event) || hotkey.preventDefault) {
        event.preventDefault()
      }
      return
    }

    log(`No hotkey matched "${event.key}"`)
  }

  /* --------------------------------------------------------- tooltips ---- */

  // Marks the elements we've titled, so disabling can remove them again.
  const TOOLTIP_ATTR = "data-amplience-hotkey"

  function removeTooltip(el) {
    el.removeAttribute("title")
    el.removeAttribute(TOOLTIP_ATTR)
  }

  function applyTooltips() {
    const titled = new Set()

    for (const hotkey of activeHotkeys()) {
      if (!hotkey.target) continue

      const el = document.querySelector(hotkey.target)
      if (!el) continue

      const title = `${hotkey.label} (${keyLabel(hotkey)})`
      if (el.getAttribute("title") !== title) {
        el.setAttribute("title", title)
        el.setAttribute(TOOLTIP_ATTR, "")
      }
      titled.add(el)
    }

    // Clear tooltips from elements that no longer match, e.g. the V target
    // moving to the other view-toggle option once the view has switched.
    document.querySelectorAll(`[${TOOLTIP_ATTR}]`).forEach((el) => {
      if (!titled.has(el)) removeTooltip(el)
    })
  }

  function removeTooltips() {
    document.querySelectorAll(`[${TOOLTIP_ATTR}]`).forEach(removeTooltip)
  }

  // React re-renders and route changes swap buttons in and out, so tooltips
  // are re-applied (debounced) whenever the DOM changes.
  let tooltipObserver = null
  let tooltipTimer = null

  function startTooltips() {
    applyTooltips()
    tooltipObserver = new MutationObserver(() => {
      clearTimeout(tooltipTimer)
      tooltipTimer = setTimeout(applyTooltips, 200)
    })
    tooltipObserver.observe(document.body, { childList: true, subtree: true })
  }

  function stopTooltips() {
    if (tooltipObserver) tooltipObserver.disconnect()
    tooltipObserver = null
    clearTimeout(tooltipTimer)
    removeTooltips()
  }

  /* ----------------------------------------------------- help overlay ---- */

  // Reuses the #hotkey-help-overlay styles from hotkeys.css.
  function showHelpOverlay() {
    const overlay = document.createElement("div")
    overlay.id = "hotkey-help-overlay"

    const columns = Object.keys(HOTKEYS)
      .filter((page) => HOTKEYS[page].length)
      .map((page) => {
        const groups = {}
        HOTKEYS[page].forEach((hotkey) => {
          ;(groups[hotkey.group] = groups[hotkey.group] || []).push(hotkey)
        })

        const sections = Object.entries(groups)
          .map(
            ([group, hotkeys]) =>
              `<h4>${group}</h4><dl>${hotkeys
                .map((h) => `<dt>${keyLabel(h)}</dt><dd>${h.label}</dd>`)
                .join("")}</dl>`,
          )
          .join("")

        return `<div><h3>${PAGE_TITLES[page]}</h3>${sections}</div>`
      })
      .join("")

    overlay.innerHTML = `<h2>Amplience Hotkeys</h2>
<div class="cols">${columns}</div>
<p class="closeHelpText">Click anywhere or press any key to close this overlay.</p>`

    // Deferred so the "?" keydown that opened it doesn't close it straight away.
    const close = () => {
      overlay.remove()
      document.removeEventListener("click", close)
      document.removeEventListener("keydown", close)
    }
    setTimeout(() => {
      document.addEventListener("click", close)
      document.addEventListener("keydown", close)
    }, 0)

    document.body.appendChild(overlay)
  }

  /* -------------------------------------------------------- lifecycle ---- */

  let enabled = false

  function applyHotkeysSetting(value) {
    value = Boolean(value)
    log("Hotkeys setting:", value)
    if (value === enabled) return
    enabled = value

    if (enabled) {
      document.addEventListener("keydown", handleKeydown)
      startTooltips()
      return
    }

    document.removeEventListener("keydown", handleKeydown)
    stopTooltips()
    document.getElementById("hotkey-help-overlay")?.remove()
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    applyHotkeysSetting(settings.hotkeysEnabled)
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.hotkeysEnabled) return
    applyHotkeysSetting(changes.hotkeysEnabled.newValue)
  })
})()
