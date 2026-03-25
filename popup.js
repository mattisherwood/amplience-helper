;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    flowFilter: true,
    hotkeysEnabled: true,
    stylesEnabled: true,
  }

  const contentFlowsCheckbox = document.getElementById("flowFilter")
  const hotkeysCheckbox = document.getElementById("hotkeysEnabled")
  const stylesCheckbox = document.getElementById("stylesEnabled")

  function loadSettings() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      contentFlowsCheckbox.checked = settings.flowFilter
      hotkeysCheckbox.checked = settings.hotkeysEnabled
      stylesCheckbox.checked = settings.stylesEnabled
    })
  }

  function saveSettings() {
    chrome.storage.sync.set({
      flowFilter: contentFlowsCheckbox.checked,
      hotkeysEnabled: hotkeysCheckbox.checked,
      stylesEnabled: stylesCheckbox.checked,
    })
  }

  function handleStorageChange(changes, area) {
    if (area !== "sync") {
      return
    }

    if (changes.flowFilter) {
      contentFlowsCheckbox.checked = Boolean(changes.flowFilter.newValue)
    }

    if (changes.hotkeysEnabled) {
      hotkeysCheckbox.checked = Boolean(changes.hotkeysEnabled.newValue)
    }

    if (changes.stylesEnabled) {
      stylesCheckbox.checked = Boolean(changes.stylesEnabled.newValue)
    }
  }

  contentFlowsCheckbox.addEventListener("change", saveSettings)
  hotkeysCheckbox.addEventListener("change", saveSettings)
  stylesCheckbox.addEventListener("change", saveSettings)

  chrome.storage.onChanged.addListener(handleStorageChange)
  document.addEventListener("DOMContentLoaded", loadSettings)
})()
