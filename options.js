;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    faviconSwapperEnabled: true,
    flowFilter: true,
    hotkeysEnabled: true,
    stylesEnabled: true,
    themingEnabled: true,
    themingHubs: {},
  }

  const DEFAULT_HUB_THEME = {
    color: "3, 116, 221",
    isDark: false,
  }

  const faviconSwapperCheckbox = document.getElementById("faviconSwapper")
  const contentFlowsCheckbox = document.getElementById("flowFilter")
  const hotkeysCheckbox = document.getElementById("hotkeysEnabled")
  const stylesCheckbox = document.getElementById("stylesEnabled")
  const themingCheckbox = document.getElementById("themingEnabled")
  const themeControls = document.getElementById("themeControls")
  const themeRowsContainer = document.getElementById("themeRows")
  const themeRowTemplate = document.getElementById("themeRowTemplate")
  const statusEl = document.getElementById("status")

  function showStatus(message) {
    statusEl.textContent = message

    window.setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = ""
      }
    }, 1500)
  }

  function renderDarkToggle(button, enabled) {
    enabled = Boolean(enabled)
    button.textContent = enabled ? "☽" : "☀"
    button.setAttribute("aria-pressed", String(enabled))
    button.setAttribute(
      "aria-label",
      enabled ? "Disable dark mode" : "Enable dark mode",
    )
    button.title = enabled ? "Disable dark mode" : "Enable dark mode"
  }

  function updateColorSwatch(swatch, color) {
    swatch.style.backgroundColor = `rgb(${color})`
  }

  function renderThemeRow(hubName, theme) {
    const row = themeRowTemplate.content.cloneNode(true)
    const rowDiv = row.querySelector(".theme-control")
    const hubLabel = row.querySelector(".hub-label")
    const colorInput = row.querySelector(".theme-color-input")
    const colorSwatch = row.querySelector(".color-swatch")
    const darkToggle = row.querySelector(".theme-dark-toggle")
    const deleteBtn = row.querySelector(".theme-delete-btn")

    rowDiv.setAttribute("data-hubname", hubName)
    hubLabel.textContent = theme.label || hubName
    hubLabel.title = hubName
    colorInput.value = theme.color
    updateColorSwatch(colorSwatch, theme.color)
    renderDarkToggle(darkToggle, theme.isDark)

    // Event listeners for this row
    colorInput.addEventListener("change", () => {
      updateTheme(hubName, {
        color: colorInput.value || DEFAULT_HUB_THEME.color,
      })
    })

    colorInput.addEventListener("input", () => {
      updateColorSwatch(colorSwatch, colorInput.value)
    })

    darkToggle.addEventListener("click", () => {
      const newIsDark = darkToggle.getAttribute("aria-pressed") !== "true"
      renderDarkToggle(darkToggle, newIsDark)
      updateTheme(hubName, { isDark: newIsDark })
    })

    deleteBtn.addEventListener("click", () => {
      deleteTheme(hubName)
    })

    ColorPicker.init(colorInput, colorSwatch)

    return row
  }

  function renderAllThemes() {
    themeRowsContainer.innerHTML = ""
    const hubNames = Object.keys(hubs || {})
    if (hubNames.length === 0) {
      themeRowsContainer.innerHTML =
        '<p style="padding: 20px; color: var(--muted); font-size: 14px; text-align: center;">No themes configured yet. They will appear when you visit different hubs.</p>'
      return
    }
    hubNames.forEach((hubName) => {
      const row = renderThemeRow(hubName, hubs[hubName])
      themeRowsContainer.appendChild(row)
    })
  }

  function updateTheme(hubName, updates) {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      const hubs = settings.themingHubs || {}
      if (!hubs[hubName]) {
        hubs[hubName] = { ...DEFAULT_HUB_THEME }
      }
      hubs[hubName] = { ...hubs[hubName], ...updates }
      chrome.storage.sync.set({ themingHubs: hubs }, () => {
        showStatus("Saved")
      })
    })
  }

  function deleteTheme(hubName) {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      const hubs = settings.themingHubs || {}
      delete hubs[hubName]
      chrome.storage.sync.set({ themingHubs: hubs }, () => {
        showStatus("Removed")
      })
    })
  }

  let hubs = {}

  function loadSettings() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      faviconSwapperCheckbox.checked = settings.faviconSwapperEnabled
      contentFlowsCheckbox.checked = settings.flowFilter
      hotkeysCheckbox.checked = settings.hotkeysEnabled
      stylesCheckbox.checked = settings.stylesEnabled
      themingCheckbox.checked = settings.themingEnabled
      themeControls.hidden = !settings.themingEnabled
      hubs = settings.themingHubs || {}
      renderAllThemes()
    })
  }

  function saveSettings() {
    chrome.storage.sync.set(
      {
        faviconSwapperEnabled: faviconSwapperCheckbox.checked,
        flowFilter: contentFlowsCheckbox.checked,
        hotkeysEnabled: hotkeysCheckbox.checked,
        stylesEnabled: stylesCheckbox.checked,
        themingEnabled: themingCheckbox.checked,
      },
      () => {
        showStatus("Saved")
      },
    )
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

    if (changes.themingHubs) {
      hubs = changes.themingHubs.newValue || {}
      renderAllThemes()
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

  chrome.storage.onChanged.addListener(handleStorageChange)
  document.addEventListener("DOMContentLoaded", loadSettings)
})()
