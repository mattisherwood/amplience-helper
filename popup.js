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

  // Update UI elements
  const updateSection = document.getElementById("updateSection")
  const updateButton = document.getElementById("updateButton")
  const updateStatus = document.getElementById("updateStatus")
  const updateStatusText = document.getElementById("updateStatusText")
  const updateButtonText = document.getElementById("updateButtonText")

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

  // ============================================================================
  // UPDATE HANDLING
  // ============================================================================

  /**
   * Display update status in the popup
   */
  function displayUpdateStatus() {
    chrome.runtime.sendMessage({ action: "getUpdateStatus" }, (response) => {
      if (response?.availableVersion) {
        updateSection.style.display = "block"
        updateButtonText.textContent = `Update Available (${response.availableVersion})`
      } else {
        updateSection.style.display = "none"
      }
    })
  }

  /**
   * Handle update button click
   */
  async function handleUpdateClick() {
    updateButton.disabled = true
    updateStatusText.textContent = "Downloading update..."
    updateStatus.style.display = "block"

    try {
      const response = await chrome.runtime.sendMessage({
        action: "downloadUpdate",
        version: document
          .getElementById("updateButtonText")
          .textContent.match(/\(([^)]+)\)/)?.[1],
      })

      if (response?.success) {
        updateStatusText.textContent = `✓ Update ready! Please reload the extension to apply.`
        updateButtonText.textContent = "Reload Extension"
        updateButton.disabled = false
        updateButton.onclick = () => {
          chrome.runtime.reload()
        }
      } else {
        updateStatusText.innerHTML = `✗ ${response?.message}<br/><a href="${response?.fallbackDownloadUrl}" target="_blank" style="color: #DC2626; text-decoration: underline;">Download manually from GitHub</a>`
        updateButton.disabled = false
      }
    } catch (error) {
      updateStatusText.textContent = `✗ Error: ${error.message}`
      updateButton.disabled = false
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  contentFlowsCheckbox.addEventListener("change", saveSettings)
  hotkeysCheckbox.addEventListener("change", saveSettings)
  stylesCheckbox.addEventListener("change", saveSettings)

  updateButton.addEventListener("click", handleUpdateClick)

  chrome.storage.onChanged.addListener(handleStorageChange)

  document.addEventListener("DOMContentLoaded", () => {
    loadSettings()
    displayUpdateStatus()
  })
})()
