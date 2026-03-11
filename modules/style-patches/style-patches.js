;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    stylesEnabled: true,
  }

  function applyStylesSetting(enabled) {
    if (enabled) {
      document.documentElement.setAttribute("data-amplience-patches", "enabled")
      return
    }

    document.documentElement.removeAttribute("data-amplience-patches")
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
