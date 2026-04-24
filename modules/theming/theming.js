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

  /**
   * Extract the hub name from the current page URL.
   * Pattern: #!/hubname/ in the URL hash
   * @returns {string|null} The hub name or null if not found
   */
  function getHubNameFromUrl() {
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

  function applyDarkSetting(enabled) {
    document.documentElement.classList.toggle("dark", enabled)
  }

  function applyColorSetting(color) {
    document.documentElement.style.setProperty("--theme-color-rgb", color)
  }

  /**
   * Apply the theme for the current hub.
   * If the hub doesn't exist, create it with default values.
   */
  function applyCurrentHubTheme() {
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
    if (window.location.href !== previousUrl) {
      previousUrl = window.location.href
      applyCurrentHubTheme()
    }
  }, 500)

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") {
      return
    }

    // If themingHubs changed, reapply the current hub's theme
    if (changes.themingHubs) {
      const hubName = getHubNameFromUrl()
      if (hubName && !isExcludedHub(hubName)) {
        const newHubs = changes.themingHubs.newValue || {}
        const hubTheme = newHubs[hubName]
        if (hubTheme) {
          applyColorSetting(hubTheme.color)
          applyDarkSetting(hubTheme.isDark)
        }
      }
    }

    if (changes.themingEnabled) {
      applyThemingSetting(Boolean(changes.themingEnabled.newValue))
    }
  })
})()
