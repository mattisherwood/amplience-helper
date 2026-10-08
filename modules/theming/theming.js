;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    themingEnabled: true,
    themingHubs: {},
  }

  const DEFAULT_HUB_THEME = {
    color: "3, 116, 221",
    isDark: false,
  }

  const EXCLUDED_HUBS = new Set(["login-prompt"])

  const IS_NEXTGEN = window.location.hostname === "nextgen.amplience.net"

  // Nextgen areas whose second path segment is a hub name.
  const NEXTGEN_HUB_AREAS = new Set(["content", "media", "flows", "reviews"])

  /**
   * Extract the hub name from the current page URL.
   * Legacy: #!/hubname/ in the URL hash
   * Nextgen: /:orgName/:area/:hubName/... in the path
   * @returns {string|null} The hub name or null if not found
   */
  function getHubNameFromUrl() {
    if (IS_NEXTGEN) {
      const [, area, hubName] = window.location.pathname
        .split("/")
        .filter(Boolean)
      return NEXTGEN_HUB_AREAS.has(area) && hubName ? hubName : null
    }

    const match = window.location.href.match(/\/[#!]+\/([^/]+)/)
    return match ? match[1] : null
  }

  function isExcludedHub(hubName) {
    return hubName ? EXCLUDED_HUBS.has(hubName) : false
  }

  /**
   * Attempt to fetch the user-friendly label for the current hub from the DOM.
   * @returns {string|null} The label or null if not found
   */
  function getHubLabelFromDom() {
    try {
      const elem = document.querySelector(
        "am-hub-selector md-menu > .md-button ng-transclude",
      )
      return elem?.innerText?.trim() || null
    } catch {
      return null
    }
  }

  function applyThemingSetting(enabled) {
    if (enabled) {
      document.documentElement.setAttribute("data-amplience-theming", "enabled")
      return
    }

    document.documentElement.removeAttribute("data-amplience-theming")
  }

  /*
   * Nextgen dark mode goes through Mantine's own data-mantine-color-scheme
   * attribute on <html> rather than the legacy .dark class.
   *
   * Mantine owns that attribute: it sets it from the user's preference on
   * load and whenever they change it. So dark hubs override it, and anything
   * else hands it back: nativeScheme tracks Mantine's latest value and is
   * restored when the hub isn't dark or theming is off. The observer also
   * re-asserts "dark" if Mantine writes after us (e.g. a late React mount).
   * If Mantine renames the attribute, hubs just stay on the native scheme.
   */
  const SCHEME_ATTR = "data-mantine-color-scheme"
  let forceDark = false
  let nativeScheme = null
  let lastWrittenScheme = null

  function syncColorScheme() {
    const html = document.documentElement
    const wanted = forceDark ? "dark" : nativeScheme

    if (wanted && html.getAttribute(SCHEME_ATTR) !== wanted) {
      lastWrittenScheme = wanted
      html.setAttribute(SCHEME_ATTR, wanted)
    }
  }

  if (IS_NEXTGEN) {
    nativeScheme = document.documentElement.getAttribute(SCHEME_ATTR)

    new MutationObserver(() => {
      const current = document.documentElement.getAttribute(SCHEME_ATTR)
      if (current === lastWrittenScheme) return

      // Mantine wrote it, so that's the user's own preference.
      nativeScheme = current
      lastWrittenScheme = null
      syncColorScheme()
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: [SCHEME_ATTR],
    })
  }

  function applyDarkSetting(enabled) {
    if (IS_NEXTGEN) {
      forceDark = Boolean(enabled)
      syncColorScheme()
      return
    }

    document.documentElement.classList.toggle("dark", enabled)
  }

  function applyColorSetting(color) {
    document.documentElement.style.setProperty("--theme-color-rgb", color)
    const menuToggle = document.querySelector("ui-view")
    if (menuToggle) menuToggle.style.setProperty("--hub-row-color", color)
  }

  /**
   * Apply the theme for the current hub.
   * If the hub doesn't exist, create it with default values.
   */
  function applyCurrentHubTheme() {
    if (!chrome.runtime?.id) return
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      const hubName = getHubNameFromUrl()

      // Only apply theming if enabled
      applyThemingSetting(settings.themingEnabled)

      if (isExcludedHub(hubName)) {
        // Keep ignored routes out of stored per-hub theme state.
        const hubs = settings.themingHubs || {}
        if (hubs[hubName]) {
          delete hubs[hubName]
          chrome.storage.sync.set({ themingHubs: hubs })
        }

        applyDarkSetting(false)
        applyColorSetting(DEFAULT_HUB_THEME.color)
        return
      }

      // If no hub name detected or theming disabled, use defaults
      if (!hubName || !settings.themingEnabled) {
        applyDarkSetting(false)
        applyColorSetting(DEFAULT_HUB_THEME.color)
        return
      }

      const hubs = settings.themingHubs || {}
      let hubTheme = hubs[hubName]

      // If theme doesn't exist, create it with defaults
      if (!hubTheme) {
        hubTheme = { ...DEFAULT_HUB_THEME, label: hubName }
        hubs[hubName] = hubTheme
        chrome.storage.sync.set({ themingHubs: hubs })
      }

      // Apply the theme for this hub
      applyColorSetting(hubTheme.color)
      applyDarkSetting(hubTheme.isDark)

      // Attempt to fetch and update the user-friendly label
      const label = getHubLabelFromDom()
      if (label && (!hubTheme.label || hubTheme.label === hubName)) {
        hubTheme.label = label
        hubs[hubName] = hubTheme
        chrome.storage.sync.set({ themingHubs: hubs })
      }
    })
  }

  // Initial theme application
  applyCurrentHubTheme()

  // Listen for URL changes (for single-page app navigation)
  let previousUrl = window.location.href
  const urlCheckInterval = setInterval(() => {
    if (!chrome.runtime?.id) {
      clearInterval(urlCheckInterval)
      return
    }
    if (window.location.href !== previousUrl) {
      previousUrl = window.location.href
      applyCurrentHubTheme()
    }
  }, 500)

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") {
      return
    }

    // Re-run the full resolve rather than patching pieces: on nextgen the
    // colour scheme lives outside our CSS gate, so turning theming off has
    // to actively hand it back to Mantine, which applyCurrentHubTheme does.
    if (changes.themingHubs || changes.themingEnabled) {
      applyCurrentHubTheme()
    }
  })
})()
