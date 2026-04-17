;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    faviconSwapperEnabled: true,
    flowFilter: true,
    hotkeysEnabled: true,
    stylesEnabled: true,
    themingEnabled: true,
    themingDark: false,
    themingColor: "60, 120, 200",
  }

  const faviconSwapperCheckbox = document.getElementById("faviconSwapper")
  const contentFlowsCheckbox = document.getElementById("flowFilter")
  const hotkeysCheckbox = document.getElementById("hotkeysEnabled")
  const stylesCheckbox = document.getElementById("stylesEnabled")
  const themingCheckbox = document.getElementById("themingEnabled")
  const themingDarkCheckbox = document.getElementById("themingDark")
  const themingColorInput = document.getElementById("themingColor")
  const themingColorSwatch = document.getElementById("themingColorSwatch")
  const themeControls = document.getElementById("themeControls")

  function updateColorSwatch(color) {
    themingColorSwatch.style.backgroundColor = `rgb(${color})`
  }

  function loadSettings() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      faviconSwapperCheckbox.checked = settings.faviconSwapperEnabled
      contentFlowsCheckbox.checked = settings.flowFilter
      hotkeysCheckbox.checked = settings.hotkeysEnabled
      stylesCheckbox.checked = settings.stylesEnabled
      themingCheckbox.checked = settings.themingEnabled
      themingDarkCheckbox.checked = settings.themingDark
      themingColorInput.value = settings.themingColor
      updateColorSwatch(settings.themingColor)
      themeControls.hidden = !settings.themingEnabled
    })
  }

  function saveSettings() {
    chrome.storage.sync.set({
      faviconSwapperEnabled: faviconSwapperCheckbox.checked,
      flowFilter: contentFlowsCheckbox.checked,
      hotkeysEnabled: hotkeysCheckbox.checked,
      stylesEnabled: stylesCheckbox.checked,
      themingEnabled: themingCheckbox.checked,
      themingDark: themingDarkCheckbox.checked,
      themingColor: themingColorInput.value || DEFAULT_SETTINGS.themingColor,
    })
  }

  function handleStorageChange(changes, area) {
    if (area !== "sync") {
      return
    }

    if (changes.faviconSwapperEnabled) {
      faviconSwapperCheckbox.checked = Boolean(
        changes.faviconSwapperEnabled.newValue,
      )
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

    if (changes.themingEnabled) {
      themingCheckbox.checked = Boolean(changes.themingEnabled.newValue)
      themeControls.hidden = !changes.themingEnabled.newValue
    }

    if (changes.themingDark) {
      themingDarkCheckbox.checked = Boolean(changes.themingDark.newValue)
    }

    if (changes.themingColor) {
      themingColorInput.value = changes.themingColor.newValue
      updateColorSwatch(changes.themingColor.newValue)
    }
  }

  faviconSwapperCheckbox.addEventListener("change", saveSettings)
  contentFlowsCheckbox.addEventListener("change", saveSettings)
  hotkeysCheckbox.addEventListener("change", saveSettings)
  stylesCheckbox.addEventListener("change", saveSettings)
  themingCheckbox.addEventListener("change", () => {
    themeControls.hidden = !themingCheckbox.checked
    saveSettings()
  })
  themingDarkCheckbox.addEventListener("change", saveSettings)
  themingColorInput.addEventListener("change", saveSettings)
  ColorPicker.init(themingColorInput, themingColorSwatch)
  themingColorInput.addEventListener("input", () =>
    updateColorSwatch(themingColorInput.value),
  )

  chrome.storage.onChanged.addListener(handleStorageChange)
  document.addEventListener("DOMContentLoaded", loadSettings)
})()
