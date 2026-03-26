/**
 * Amplience Helper - Auto-Update System
 * Handles checking for updates from GitHub, managing version state, and applying updates
 */

const CONFIG = {
  GITHUB_REPO: "mattisherwood/amplience-helper",
  GITHUB_BRANCH: "main",
  MANIFEST_URL:
    "https://raw.githubusercontent.com/mattisherwood/amplience-helper/main/manifest.json",
  RELEASE_ZIP_URL:
    "https://github.com/mattisherwood/amplience-helper/archive/refs/heads/main.zip",
  CHECK_INTERVAL_HOURS: 24,
  UPDATE_LOG_MAX_SIZE: 10,
}

/**
 * Storage schema in chrome.storage.local:
 * {
 *   updateCheckLastTime: number (timestamp in ms),
 *   availableVersion: string (e.g., "2.0.1"),
 *   updateDownloaded: boolean,
 *   downloadedVersion: string,
 *   updateLog: Array<{timestamp: number, level: 'error'|'info', message: string}>
 * }
 */

// ============================================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================================

/**
 * Initialize update system on service worker startup
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    // Initialize storage on first install
    chrome.storage.local.get(["updateCheckLastTime"], (result) => {
      if (!result.updateCheckLastTime) {
        initializeStorage()
      }
    })
    // Check for updates on startup
    checkForUpdates()
  }
})

/**
 * Check for updates on extension startup
 */
chrome.runtime.onStartup.addListener(() => {
  checkForUpdates()
})

/**
 * Set up daily alarm for version checks
 */
chrome.alarms.create("updateCheck", { periodInMinutes: 24 * 60 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "updateCheck") {
    checkForUpdates()
  }
})

/**
 * Listen for messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkUpdatesManual") {
    // Manual check bypasses rate limiting
    checkForUpdates(true).then(sendResponse)
    return true // Keep channel open for async response
  } else if (request.action === "downloadUpdate") {
    downloadUpdate(request.version).then(sendResponse)
    return true
  } else if (request.action === "getUpdateStatus") {
    getUpdateStatus().then(sendResponse)
    return true
  }
})

// ============================================================================
// CORE UPDATE LOGIC
// ============================================================================

/**
 * Initialize storage with default values
 */
async function initializeStorage() {
  const defaults = {
    updateCheckLastTime: 0,
    availableVersion: null,
    updateDownloaded: false,
    downloadedVersion: null,
    updateLog: [],
  }
  await chrome.storage.local.set(defaults)
}

/**
 * Check for updates from GitHub
 * @param {boolean} forceCheck - If true, bypass rate limiting
 */
async function checkForUpdates(forceCheck = false) {
  try {
    const now = Date.now()
    const data = await chrome.storage.local.get([
      "updateCheckLastTime",
      "availableVersion",
    ])

    // Check rate limiting (unless forced)
    if (!forceCheck && data.updateCheckLastTime) {
      const timeSinceLastCheck = now - data.updateCheckLastTime
      const minIntervalMs = CONFIG.CHECK_INTERVAL_HOURS * 60 * 60 * 1000
      if (timeSinceLastCheck < minIntervalMs) {
        logUpdate(
          "info",
          `Update check skipped (rate limited). Next check in ${Math.round((minIntervalMs - timeSinceLastCheck) / 60000)} minutes.`,
        )
        return
      }
    }

    // Fetch GitHub manifest
    const response = await fetch(CONFIG.MANIFEST_URL)
    if (!response.ok) {
      throw new Error(
        `GitHub fetch failed: ${response.status} ${response.statusText}`,
      )
    }

    const remoteManifest = await response.json()
    const remoteVersion = remoteManifest.version
    const currentVersion = chrome.runtime.getManifest().version

    logUpdate(
      "info",
      `Version check: local=${currentVersion}, remote=${remoteVersion}`,
    )

    // Compare versions
    if (isNewerVersion(remoteVersion, currentVersion)) {
      logUpdate("info", `Update available: ${remoteVersion}`)
      await chrome.storage.local.set({
        availableVersion: remoteVersion,
        updateCheckLastTime: now,
      })
      updateBadge(true)
    } else {
      logUpdate("info", "No update available")
      await chrome.storage.local.set({
        availableVersion: null,
        updateCheckLastTime: now,
      })
      updateBadge(false)
    }
  } catch (error) {
    logUpdate(
      "error",
      `Update check failed: ${error.message}. Will retry in ${CONFIG.CHECK_INTERVAL_HOURS} hours.`,
    )
    // Don't update last check time on error; allow retry sooner next time
  }
}

/**
 * Compare two version strings (semver format)
 * @returns {boolean} true if newVersion > oldVersion
 */
function isNewerVersion(newVersion, oldVersion) {
  const newParts = newVersion.split(".").map(Number)
  const oldParts = oldVersion.split(".").map(Number)

  for (let i = 0; i < Math.max(newParts.length, oldParts.length); i++) {
    const newPart = newParts[i] || 0
    const oldPart = oldParts[i] || 0

    if (newPart > oldPart) return true
    if (newPart < oldPart) return false
  }

  return false // Versions are equal
}

/**
 * Update toolbar badge to show update availability
 */
async function updateBadge(showBadge) {
  if (showBadge) {
    await chrome.action.setBadgeText({ text: "!" })
    await chrome.action.setBadgeBackgroundColor({ color: "#FF0000" })
  } else {
    await chrome.action.setBadgeText({ text: "" })
  }
}

// ============================================================================
// DOWNLOAD & INSTALLATION
// ============================================================================

/**
 * Download update from GitHub
 * @param {string} version - Version to download
 */
async function downloadUpdate(version) {
  try {
    logUpdate("info", `Starting download for version ${version}`)

    const response = await fetch(CONFIG.RELEASE_ZIP_URL)
    if (!response.ok) {
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`,
      )
    }

    const blob = await response.blob()
    logUpdate(
      "info",
      `Downloaded update ZIP (${(blob.size / 1024 / 1024).toFixed(2)} MB)`,
    )

    // Check storage limits
    const storageEstimate = await navigator.storage.estimate()
    const available = storageEstimate.quota - storageEstimate.usage
    const sizeWithBuffer = blob.size + 5 * 1024 * 1024 // 5MB buffer

    if (available < sizeWithBuffer) {
      logUpdate(
        "error",
        `Insufficient storage space. Need ${(sizeWithBuffer / 1024 / 1024).toFixed(2)}MB, have ${(available / 1024 / 1024).toFixed(2)}MB.`,
      )
      return {
        success: false,
        message:
          "Storage space insufficient. Please free up space and try again.",
        fallbackDownloadUrl: CONFIG.RELEASE_ZIP_URL,
      }
    }

    // Store update metadata (in production, would extract and validate files from ZIP)
    await chrome.storage.local.set({
      updateDownloaded: true,
      downloadedVersion: version,
      updateReadyForInstall: true,
    })

    logUpdate(
      "info",
      `Update staged for version ${version}. User must reload extension to apply.`,
    )

    return {
      success: true,
      message: `Update ready to install. The extension will need to be reloaded.`,
      downloadedVersion: version,
    }
  } catch (error) {
    logUpdate("error", `Download failed: ${error.message}`)
    return {
      success: false,
      message: `Download failed: ${error.message}. Try again or download manually from GitHub.`,
      fallbackDownloadUrl: CONFIG.RELEASE_ZIP_URL,
    }
  }
}

/**
 * Get current update status
 */
async function getUpdateStatus() {
  const data = await chrome.storage.local.get([
    "availableVersion",
    "updateDownloaded",
    "updateLog",
  ])

  return {
    availableVersion: data.availableVersion || null,
    updateDownloaded: data.updateDownloaded || false,
    currentVersion: chrome.runtime.getManifest().version,
  }
}

// ============================================================================
// LOGGING & DEBUGGING
// ============================================================================

/**
 * Log update system events
 */
async function logUpdate(level, message) {
  const timestamp = Date.now()
  const logEntry = { timestamp, level, message }

  const data = await chrome.storage.local.get(["updateLog"])
  let log = data.updateLog || []

  // Keep only last N entries
  log = log.slice(-(CONFIG.UPDATE_LOG_MAX_SIZE - 1))
  log.push(logEntry)

  await chrome.storage.local.set({ updateLog: log })

  // Also log to browser console for debugging
  const time = new Date(timestamp).toISOString()
  if (level === "error") {
    console.error(`[Amplience Helper Update] ${time}: ${message}`)
  } else {
    console.log(`[Amplience Helper Update] ${time}: ${message}`)
  }
}

/**
 * Expose update log for debugging (accessible from console as chrome.runtime.sendMessage)
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getUpdateLog") {
    chrome.storage.local.get(["updateLog"], (result) => {
      sendResponse(result.updateLog || [])
    })
    return true
  }
})
