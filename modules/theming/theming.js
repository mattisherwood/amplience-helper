;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    themingEnabled: true,
    themingDark: false,
    themingColor: "170, 190, 255",
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
    document.documentElement.style.setProperty("--theme-color", color)
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    applyThemingSetting(settings.themingEnabled)
    applyDarkSetting(settings.themingDark)
    applyColorSetting(settings.themingColor)
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") {
      return
    }

    if (changes.themingEnabled) {
      applyThemingSetting(Boolean(changes.themingEnabled.newValue))
    }

    if (changes.themingDark) {
      applyDarkSetting(Boolean(changes.themingDark.newValue))
    }

    if (changes.themingColor) {
      applyColorSetting(changes.themingColor.newValue)
    }
  })
})()
