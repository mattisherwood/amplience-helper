;(function () {
  "use strict"

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

  // Parse hub ID from listing/detail URL
  function extractHubIdFromUrl() {
    const match = window.location.pathname.match(
      /\/content-studio\/([^/]+)\/content-flows/,
    )
    if (!match || !match[1]) {
      return null
    }

    try {
      return decodeURIComponent(match[1])
    } catch (error) {
      return match[1]
    }
  }

  // Check if we're on a flow detail page
  function isFlowDetailPage() {
    return /\/content-studio\/[^/]+\/content-flows\/[^/]+/.test(
      window.location.pathname,
    )
  }

  // Check if we're on the flow listing page
  function isFlowListingPage() {
    return /\/content-studio\/[^/]+\/content-flows$/.test(
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
      removeImportButton()
    } else if (isFlowListingPage()) {
      removeExportButton()
      injectImportButton()
    } else {
      removeExportButton()
      removeImportButton()
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

  async function createContentFlow(hubId, flowData) {
    try {
      const jwt = extractJwtFromAuth0Storage()
      if (!jwt) {
        return {
          success: false,
          error: "Authentication failed. Please refresh the page.",
        }
      }

      const mutation = `
        mutation createContentFlow($hubId: ID!, $label: String!, $description: String!, $flow: String!) {
          createContentFlow(
            input: {
              label: $label,
              description: $description,
              flow: $flow,
              cmsHubId: $hubId
            }
          ) {
            id
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
          query: mutation,
          variables: {
            hubId,
            label: flowData.label,
            description: flowData.description,
            flow: flowData.flow,
          },
        }),
      })

      const payload = await response.json()

      if (!response.ok || payload?.errors?.length > 0) {
        const errorMsg =
          payload?.errors?.[0]?.message || "Failed to import flow"
        return {
          success: false,
          error: `Import failed: ${errorMsg}`,
        }
      }

      if (!payload?.data?.createContentFlow?.id) {
        return {
          success: false,
          error: "Import failed: invalid response from server.",
        }
      }

      return {
        success: true,
      }
    } catch (error) {
      console.error("[Amplience Helper] Flow import error:", error)
      return {
        success: false,
        error: "Import error. Check console for details.",
      }
    }
  }

  function pickJsonFile() {
    return new Promise((resolve) => {
      const fileInput = document.createElement("input")
      fileInput.type = "file"
      fileInput.accept = ".json,application/json"
      fileInput.style.display = "none"
      document.body.appendChild(fileInput)

      let settled = false

      const cleanup = () => {
        window.removeEventListener("focus", onWindowFocus)
        if (fileInput.parentElement) {
          fileInput.parentElement.removeChild(fileInput)
        }
      }

      const finish = (file) => {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        resolve(file || null)
      }

      const onWindowFocus = () => {
        // If the picker was cancelled, no change event may fire.
        setTimeout(() => {
          if (!settled) {
            finish(null)
          }
        }, 300)
      }

      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0]
        finish(file || null)
      })

      window.addEventListener("focus", onWindowFocus)
      fileInput.click()
    })
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("Could not read selected file."))
      reader.readAsText(file)
    })
  }

  function validateImportedFlow(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        success: false,
        error: "Invalid file format. JSON object expected.",
      }
    }

    const requiredFields = ["label", "description", "status", "flow"]
    for (const field of requiredFields) {
      if (!Object.prototype.hasOwnProperty.call(data, field)) {
        return {
          success: false,
          error: `Invalid file format. Missing required property: ${field}`,
        }
      }
    }

    if (typeof data.label !== "string" || data.label.trim() === "") {
      return {
        success: false,
        error: "Invalid file format. label must be a non-empty string.",
      }
    }

    if (typeof data.description !== "string") {
      return {
        success: false,
        error: "Invalid file format. description must be a string.",
      }
    }

    if (typeof data.status !== "string") {
      return {
        success: false,
        error: "Invalid file format. status must be a string.",
      }
    }

    if (typeof data.flow !== "string" || data.flow.trim() === "") {
      return {
        success: false,
        error: "Invalid file format. flow must be a non-empty string.",
      }
    }

    return {
      success: true,
      data,
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

  async function handleImportClick(button, statusEl) {
    button.disabled = true
    setButtonStatus(button, statusEl, "Choose a file...", false)

    const selectedFile = await pickJsonFile()

    if (!selectedFile) {
      setButtonStatus(button, statusEl, "", false)
      button.disabled = false
      return
    }

    setButtonStatus(button, statusEl, "Importing...", false)

    try {
      const fileText = await readFileAsText(selectedFile)
      let parsed

      try {
        parsed = JSON.parse(fileText)
      } catch (error) {
        setButtonStatus(
          button,
          statusEl,
          "Invalid file format. Must be valid JSON.",
          true,
        )
        button.disabled = false
        return
      }

      const validationResult = validateImportedFlow(parsed)
      if (!validationResult.success) {
        setButtonStatus(button, statusEl, validationResult.error, true)
        button.disabled = false
        return
      }

      const hubId = extractHubIdFromUrl()
      if (!hubId) {
        setButtonStatus(
          button,
          statusEl,
          "Could not determine hub ID from URL.",
          true,
        )
        button.disabled = false
        return
      }

      const createResult = await createContentFlow(hubId, validationResult.data)
      if (!createResult.success) {
        setButtonStatus(button, statusEl, createResult.error, true)
        button.disabled = false
        return
      }

      setButtonStatus(button, statusEl, "Imported", false)
      window.location.reload()
    } catch (error) {
      setButtonStatus(
        button,
        statusEl,
        "Import failed. Please try again.",
        true,
      )
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
    statusElement.style.fontSize = "12px"
    statusElement.style.whiteSpace = "nowrap"

    // Add click handler
    exportButton.addEventListener("click", () => {
      handleExportClick(exportButton, statusElement, flowId)
    })

    buttonWrapper.appendChild(exportButton)
    buttonWrapper.appendChild(statusElement)

    targetContainer.appendChild(buttonWrapper)
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
    statusElement.style.fontSize = "12px"
    statusElement.style.whiteSpace = "nowrap"

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
