;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    enhancedNamingEnabled: true,
  }

  function applyEnhancedNamingSetting(enabled) {
    if (enabled) {
      document.documentElement.setAttribute(
        "data-amplience-enhanced-naming",
        "enabled",
      )
      return
    }

    document.documentElement.removeAttribute("data-amplience-enhanced-naming")
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    applyEnhancedNamingSetting(settings.enhancedNamingEnabled)
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.enhancedNamingEnabled) {
      return
    }

    applyEnhancedNamingSetting(Boolean(changes.enhancedNamingEnabled.newValue))
  })
})()
