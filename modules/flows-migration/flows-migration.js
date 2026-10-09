;(function () {
  "use strict"

  // Shared API/file logic lives in flows-migration.core.js (loaded first).
  const core = globalThis.AmplienceFlowsMigration
  if (!core) {
    console.error("[Amplience Helper] flows-migration.core.js not loaded")
    return
  }

  const DEFAULT_SETTINGS = {
    flowsMigrationEnabled: true,
  }

  let enabled = false
  let observerActive = false
  let currentFlowId = null
  let currentUrl = window.location.href
  let exportButtonInjected = false
  let exportInjectAttempts = 0
  let exportInjectTimeout = null
  let importButtonInjected = false
  let importInjectAttempts = 0
  let importInjectTimeout = null
  let routeCheckTimeout = null

  const MAX_INJECT_ATTEMPTS = 20
  const INJECT_RETRY_INTERVAL = 250
  const ROUTE_CHECK_INTERVAL = 300

  // Parse flow ID from current URL
  function extractFlowIdFromUrl() {
    const segments = window.location.pathname.split("/").filter(Boolean)
    const flowsIndex = segments.indexOf("content-flows")

    if (flowsIndex === -1 || flowsIndex + 1 >= segments.length) {
      return null
    }

    return segments[flowsIndex + 1]
  }

  // Parse hub ID from listing/detail URL
  function extractHubIdFromUrl() {
    const pathname = window.location.pathname
    const contentStudioPrefix = "/content-studio/"
    const contentFlowsMarker = "/content-flows"
    const startIndex = pathname.indexOf(contentStudioPrefix)

    if (startIndex === -1) {
      return null
    }

    const hubStart = startIndex + contentStudioPrefix.length
    const flowsIndex = pathname.indexOf(contentFlowsMarker, hubStart)

    if (flowsIndex === -1 || flowsIndex <= hubStart) {
      return null
    }

    const rawHubId = pathname.slice(hubStart, flowsIndex)

    try {
      return decodeURIComponent(rawHubId)
    } catch (error) {
      return rawHubId
    }
  }

  function getContentFlowsPathContext() {
    const segments = window.location.pathname.split("/").filter(Boolean)
    const flowsIndex = segments.indexOf("content-flows")

    if (flowsIndex === -1) {
      return {
        hasContentFlows: false,
        flowId: null,
      }
    }

    const flowId = segments[flowsIndex + 1] || null

    return {
      hasContentFlows: true,
      flowId,
    }
  }

  // Check if we're on a flow detail page
  function isFlowDetailPage() {
    const { hasContentFlows, flowId } = getContentFlowsPathContext()
    return hasContentFlows && Boolean(flowId)
  }

  // Check if we're on the flow listing page
  function isFlowListingPage() {
    const { hasContentFlows, flowId } = getContentFlowsPathContext()
    return hasContentFlows && !flowId
  }

  function scheduleRouteCheck() {
    if (routeCheckTimeout) {
      clearTimeout(routeCheckTimeout)
    }

    routeCheckTimeout = setTimeout(() => {
      routeCheckTimeout = null
      syncForCurrentRoute()
    }, ROUTE_CHECK_INTERVAL)
  }

  function syncForCurrentRoute() {
    const url = window.location.href

    if (url === currentUrl) {
      return
    }

    currentUrl = url

    if (isFlowDetailPage()) {
      injectExportButton()
      removeImportButton()
    } else if (isFlowListingPage()) {
      removeExportButton()
      injectImportButton()
    } else {
      removeExportButton()
      removeImportButton()
    }
  }

  // Update button status text
  function setButtonStatus(button, statusEl, message, isError = false) {
    if (statusEl) {
      statusEl.textContent = message
      statusEl.className = `flows-migration-status ${isError ? "error" : "success"}`
      // Clear success messages after 3 seconds
      if (!isError) {
        setTimeout(() => {
          if (statusEl && statusEl.parentElement) {
            statusEl.textContent = ""
            statusEl.className = "flows-migration-status"
          }
        }, 3000)
      }
    }
  }

  // Swap the button's label for a short progress label while busy
  // ("Exporting..." / "Importing..."), and back again with null.
  function setButtonProgress(button, label) {
    const labelEl = button.querySelector("span")
    if (!labelEl) return
    if (!labelEl.dataset.idleLabel) {
      labelEl.dataset.idleLabel = labelEl.textContent
    }
    labelEl.textContent = label || labelEl.dataset.idleLabel
    button.toggleAttribute("data-busy", Boolean(label))
  }

  // Handle export button click
  async function handleExportClick(button, statusEl, flowId) {
    button.disabled = true
    setButtonStatus(button, statusEl, "", false)
    await core.runExport({
      flowId,
      getHubId: async () => extractHubIdFromUrl(),
      onProgress: (label) => setButtonProgress(button, label),
      onResult: ({ type, message }) =>
        setButtonStatus(button, statusEl, message, type === "error"),
    })
    button.disabled = false
  }

  async function handleImportClick(button, statusEl) {
    button.disabled = true
    setButtonStatus(button, statusEl, "", false)
    const result = await core.runImport({
      getHubId: async () => extractHubIdFromUrl(),
      onProgress: (label) => setButtonProgress(button, label),
      onResult: ({ type, message }) =>
        setButtonStatus(button, statusEl, message, type === "error"),
    })

    if (result.success) {
      window.location.reload()
      return
    }

    button.disabled = false
  }

  // Inject export button into the page
  function injectExportButton() {
    if (!enabled || !isFlowDetailPage()) {
      return
    }

    const flowId = extractFlowIdFromUrl()

    if (!flowId) {
      return
    }

    // Clear any pending retry timeout
    if (exportInjectTimeout) {
      clearTimeout(exportInjectTimeout)
      exportInjectTimeout = null
    }

    // Remove old button if it exists
    const oldButton = document.querySelector("#flows-migration-export-btn")
    if (oldButton) {
      oldButton.parentElement.removeChild(oldButton)
    }

    const oldStatus = document.querySelector("#flows-migration-export-status")
    if (oldStatus) {
      oldStatus.parentElement.removeChild(oldStatus)
    }

    // Find target container
    const targetContainer = document.querySelector(
      ".mantine-AppShell-main > div > div > div:first-child > div > div:last-child",
    )

    if (!targetContainer) {
      // Retry with polling
      if (exportInjectAttempts < MAX_INJECT_ATTEMPTS) {
        exportInjectAttempts += 1
        exportInjectTimeout = setTimeout(() => {
          if (enabled) {
            injectExportButton()
          }
        }, INJECT_RETRY_INTERVAL)
      }
      return
    }

    // Create button wrapper
    const buttonWrapper = document.createElement("div")
    buttonWrapper.className = "flows-export-tool"

    // Create export button
    const exportButton = document.createElement("button")
    exportButton.id = "flows-migration-export-btn"
    exportButton.type = "button"
    exportButton.className =
      "mantine-Button-root mantine-ActionIcon-root flows-migration-btn"
    exportButton.setAttribute("aria-label", "Export Flow")
    exportButton.setAttribute("title", "Export Flow")
    exportButton.innerHTML = `
      <svg
        class="flows-migration-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        role="img"
      >
        <path d="M5 20H19C19.7956 20 20.5587 19.6839 21.1213 19.1213C21.6839 18.5587 22 17.7956 22 17V13H20V17C20 17.2652 19.8946 17.5196 19.7071 17.7071C19.5196 17.8946 19.2652 18 19 18H5C4.73478 18 4.48043 17.8946 4.29289 17.7071C4.10536 17.5196 4 17.2652 4 17V13H2V17C2 17.7956 2.31607 18.5587 2.87868 19.1213C3.44129 19.6839 4.20435 20 5 20Z" />
        <path d="M13 9.53674e-07L13 11.59L16.3 8.29L17.71 9.71L12 15L6.28996 9.71L7.70996 8.29L11 11.59L11 0L13 9.53674e-07Z" />
      </svg>
      <span>Export Flow</span>
    `

    // Create status element
    const statusElement = document.createElement("span")
    statusElement.id = "flows-migration-export-status"
    statusElement.className = "flows-migration-status"

    // Add click handler
    exportButton.addEventListener("click", () => {
      handleExportClick(exportButton, statusElement, flowId)
    })

    buttonWrapper.appendChild(exportButton)
    buttonWrapper.appendChild(statusElement)

    const primaryButton = targetContainer.querySelector(
      '[data-variant="primary"]',
    )
    if (primaryButton && primaryButton.parentElement === targetContainer) {
      targetContainer.insertBefore(buttonWrapper, primaryButton.nextSibling)
    } else {
      targetContainer.appendChild(buttonWrapper)
    }
    exportButtonInjected = true
    currentFlowId = flowId
    exportInjectAttempts = 0
  }

  function injectImportButton() {
    if (!enabled || !isFlowListingPage()) {
      return
    }

    if (importInjectTimeout) {
      clearTimeout(importInjectTimeout)
      importInjectTimeout = null
    }

    const oldImportButton = document.querySelector(
      "#flows-migration-import-btn",
    )
    if (oldImportButton && oldImportButton.parentElement) {
      oldImportButton.parentElement.remove()
    }

    const addFlowButton = document.querySelector(
      '[data-testid="add-content-flow"]',
    )

    if (!addFlowButton || !addFlowButton.parentElement) {
      if (importInjectAttempts < MAX_INJECT_ATTEMPTS) {
        importInjectAttempts += 1
        importInjectTimeout = setTimeout(() => {
          if (enabled) {
            injectImportButton()
          }
        }, INJECT_RETRY_INTERVAL)
      }
      return
    }

    const buttonWrapper = document.createElement("div")
    buttonWrapper.className = "flows-import-tool"

    const importButton = document.createElement("button")
    importButton.id = "flows-migration-import-btn"
    importButton.type = "button"
    importButton.className =
      "mantine-Button-root mantine-ActionIcon-root flows-migration-btn"
    importButton.setAttribute("aria-label", "Import Flow")
    importButton.setAttribute("title", "Import Flow")
    importButton.innerHTML = `
      <svg
        class="flows-migration-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        role="img"
      >
        <path d="M5 20h14a3 3 0 0 0 3-3v-4h-2v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4H2v4a3 3 0 0 0 3 3zm6-16.59V15h2V3.41l3.29 3.3 1.42-1.42L12 0 6.29 5.29 7.7 6.71 11 3.41z" />
      </svg>
      <span>Import Flow</span>
    `

    const statusElement = document.createElement("span")
    statusElement.id = "flows-migration-import-status"
    statusElement.className = "flows-migration-status"

    importButton.addEventListener("click", () => {
      handleImportClick(importButton, statusElement)
    })

    buttonWrapper.appendChild(statusElement)
    buttonWrapper.appendChild(importButton)
    addFlowButton.parentElement.insertBefore(buttonWrapper, addFlowButton)

    importButtonInjected = true
    importInjectAttempts = 0
  }

  // Remove export button from the page
  function removeExportButton() {
    const button = document.querySelector("#flows-migration-export-btn")
    if (button && button.parentElement) {
      button.parentElement.remove()
    }

    const status = document.querySelector("#flows-migration-export-status")
    if (status && status.parentElement) {
      status.parentElement.remove()
    }

    exportButtonInjected = false
    exportInjectAttempts = 0
    currentFlowId = null

    if (exportInjectTimeout) {
      clearTimeout(exportInjectTimeout)
      exportInjectTimeout = null
    }
  }

  function removeImportButton() {
    const button = document.querySelector("#flows-migration-import-btn")
    if (button && button.parentElement) {
      button.parentElement.remove()
    }

    const status = document.querySelector("#flows-migration-import-status")
    if (status && status.parentElement) {
      status.parentElement.remove()
    }

    importButtonInjected = false
    importInjectAttempts = 0

    if (importInjectTimeout) {
      clearTimeout(importInjectTimeout)
      importInjectTimeout = null
    }
  }

  // Setup observer to inject button on route changes
  function setupRouteObserver() {
    if (observerActive) {
      return
    }

    observerActive = true

    // Watch for pushState/replaceState
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function (...args) {
      originalPushState.apply(this, args)
      if (enabled) {
        scheduleRouteCheck()
      }
    }

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args)
      if (enabled) {
        scheduleRouteCheck()
      }
    }

    // Watch for popstate events
    window.addEventListener("popstate", () => {
      if (enabled) {
        scheduleRouteCheck()
      }
    })

    // Watch for DOM mutations (fallback for dynamic content)
    const mutationObserver = new MutationObserver(() => {
      if (!enabled) {
        return
      }

      if (window.location.href !== currentUrl) {
        scheduleRouteCheck()
        return
      }

      if (isFlowDetailPage() && !exportButtonInjected) {
        injectExportButton()
      }

      if (isFlowListingPage() && !importButtonInjected) {
        injectImportButton()
      }
    })

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  // Start the module
  function start() {
    if (enabled) return
    enabled = true
    currentUrl = window.location.href
    setupRouteObserver()

    if (isFlowDetailPage()) {
      injectExportButton()
      return
    }

    if (isFlowListingPage()) {
      injectImportButton()
    }
  }

  // Stop the module
  function stop() {
    if (!enabled) return
    enabled = false
    removeExportButton()
    removeImportButton()

    if (routeCheckTimeout) {
      clearTimeout(routeCheckTimeout)
      routeCheckTimeout = null
    }
  }

  // Initialize module based on stored setting
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (settings.flowsMigrationEnabled) {
      start()
    }
  })

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.flowsMigrationEnabled) {
      return
    }

    if (changes.flowsMigrationEnabled.newValue) {
      start()
    } else {
      stop()
    }
  })
})()
