;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    flowsMigrationEnabled: true,
  }

  let enabled = false
  let observerActive = false
  let currentFlowId = null
  let currentUrl = window.location.href
  let buttonInjected = false
  let injectAttempts = 0
  let injectTimeout = null
  let routeCheckTimeout = null

  const MAX_INJECT_ATTEMPTS = 20
  const INJECT_RETRY_INTERVAL = 250
  const ROUTE_CHECK_INTERVAL = 300

  // Extract JWT from Auth0 localStorage
  function extractJwtFromAuth0Storage() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("@@auth0spajs@@")) {
        try {
          const authData = JSON.parse(localStorage.getItem(key))
          if (authData?.body?.access_token) {
            return authData.body.access_token
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    return null
  }

  // Parse flow ID from current URL
  function extractFlowIdFromUrl() {
    const match = window.location.pathname.match(/\/content-flows\/([^/]+)/)
    return match ? match[1] : null
  }

  // Check if we're on a flow detail page
  function isFlowDetailPage() {
    return /\/content-studio\/[^/]+\/content-flows\/[^/]+/.test(
      window.location.pathname,
    )
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
    } else {
      removeExportButton()
    }
  }

  // Fetch flow data from GraphQL
  async function fetchFlowData(flowId) {
    try {
      const jwt = extractJwtFromAuth0Storage()
      if (!jwt) {
        return {
          success: false,
          error: "Authentication failed. Please refresh the page.",
        }
      }

      const query = `
        query contentFlow($flowId: ID!) {
          contentFlow(id: $flowId) {
            label
            description
            status
            flow
          }
        }
      `

      const response = await fetch("https://api.amplience.net/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          query,
          variables: { flowId },
        }),
      })

      const payload = await response.json()

      if (!response.ok || payload?.errors?.length > 0) {
        const errorMsg = payload?.errors?.[0]?.message || "Failed to fetch flow"
        return {
          success: false,
          error: `Export failed: ${errorMsg}`,
        }
      }

      if (!payload?.data?.contentFlow) {
        return {
          success: false,
          error: "Flow data not found",
        }
      }

      return {
        success: true,
        data: payload.data.contentFlow,
      }
    } catch (error) {
      console.error("[Amplience Helper] Flow export error:", error)
      return {
        success: false,
        error: "Export error. Check console for details.",
      }
    }
  }

  // Trigger download of JSON file
  function downloadFlowAsJson(flowId, flowData) {
    const jsonContent = JSON.stringify(flowData, null, 2)
    const blob = new Blob([jsonContent], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `flow-${flowId}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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

  // Handle export button click
  async function handleExportClick(button, statusEl, flowId) {
    button.disabled = true
    setButtonStatus(button, statusEl, "Exporting...", false)

    const result = await fetchFlowData(flowId)

    if (result.success) {
      downloadFlowAsJson(flowId, result.data)
      setButtonStatus(button, statusEl, "Exported", false)
      button.disabled = false
    } else {
      setButtonStatus(button, statusEl, result.error, true)
      button.disabled = false
    }
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
    if (injectTimeout) {
      clearTimeout(injectTimeout)
      injectTimeout = null
    }

    // Remove old button if it exists
    const oldButton = document.querySelector("#flows-migration-export-btn")
    if (oldButton) {
      oldButton.parentElement.removeChild(oldButton)
    }

    const oldStatus = document.querySelector(".flows-migration-status")
    if (oldStatus) {
      oldStatus.parentElement.removeChild(oldStatus)
    }

    // Find target container
    const targetContainer = document.querySelector(
      ".mantine-AppShell-main > div > div > div:first-child > div > div:last-child",
    )

    if (!targetContainer) {
      // Retry with polling
      if (injectAttempts < MAX_INJECT_ATTEMPTS) {
        injectAttempts += 1
        injectTimeout = setTimeout(() => {
          if (enabled) {
            injectExportButton()
          }
        }, INJECT_RETRY_INTERVAL)
      }
      return
    }

    // Create button wrapper
    const buttonWrapper = document.createElement("div")
    buttonWrapper.className = "flows-migration-tool"

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
        <path d="M5 20h14a3 3 0 0 0 3-3v-4h-2v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4H2v4a3 3 0 0 0 3 3zm6-16.59V15h2V3.41l3.29 3.3 1.42-1.42L12 0 6.29 5.29 7.7 6.71 11 3.41z" />
      </svg>
      <span class="flows-migration-sr-only">Export Flow</span>
    `

    // Create status element
    const statusElement = document.createElement("span")
    statusElement.className = "flows-migration-status"
    statusElement.style.fontSize = "12px"
    statusElement.style.whiteSpace = "nowrap"

    // Add click handler
    exportButton.addEventListener("click", () => {
      handleExportClick(exportButton, statusElement, flowId)
    })

    buttonWrapper.appendChild(exportButton)
    buttonWrapper.appendChild(statusElement)

    targetContainer.appendChild(buttonWrapper)
    buttonInjected = true
    currentFlowId = flowId
    injectAttempts = 0
  }

  // Remove export button from the page
  function removeExportButton() {
    const button = document.querySelector("#flows-migration-export-btn")
    if (button && button.parentElement) {
      button.parentElement.remove()
    }

    const status = document.querySelector(".flows-migration-status")
    if (status && status.parentElement) {
      status.parentElement.remove()
    }

    buttonInjected = false
    injectAttempts = 0
    currentFlowId = null

    if (injectTimeout) {
      clearTimeout(injectTimeout)
      injectTimeout = null
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

      if (isFlowDetailPage() && !buttonInjected) {
        injectExportButton()
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
    injectExportButton()
  }

  // Stop the module
  function stop() {
    if (!enabled) return
    enabled = false
    removeExportButton()

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
