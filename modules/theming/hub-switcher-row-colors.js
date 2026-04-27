;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    themingEnabled: true,
    themingHubs: {},
  }

  const EXCLUDED_HUBS = new Set(["login-prompt"])
  const HUB_MENU_ROW_SELECTOR = ".am-hub-selector__menu-option"

  let patchHubRowsDebounceTimer = null
  let cachedHubs = {}

  function isExcludedHub(hubName) {
    return hubName ? EXCLUDED_HUBS.has(hubName) : false
  }

  function normalizeForComparison(value) {
    return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "")
  }

  function extractHubKeyFromMenuAmId(menuRow) {
    const amId = menuRow.getAttribute("am-id") || ""
    const match = amId.match(/^hub-selector-dropdown__value--(.+)$/)
    return match ? match[1] : null
  }

  function resolveHubKeyForMenuRow(menuRow, hubs) {
    const hubKeys = Object.keys(hubs)
    const amIdKey = extractHubKeyFromMenuAmId(menuRow)

    if (amIdKey) {
      if (hubs[amIdKey]) {
        return amIdKey
      }

      const amIdKeyNoHyphen = amIdKey.replace(/-/g, "")
      const byNoHyphen = hubKeys.find(
        (key) => key.replace(/-/g, "") === amIdKeyNoHyphen,
      )
      if (byNoHyphen) {
        return byNoHyphen
      }

      const normalizedAmIdKey = normalizeForComparison(amIdKey)
      const byNormalizedKey = hubKeys.find(
        (key) => normalizeForComparison(key) === normalizedAmIdKey,
      )
      if (byNormalizedKey) {
        return byNormalizedKey
      }
    }

    const labelText = menuRow.querySelector("am-truncate")?.innerText?.trim()
    if (!labelText) {
      return null
    }

    const normalizedLabel = normalizeForComparison(labelText)
    return (
      hubKeys.find((key) => {
        const label = hubs[key]?.label
        return label && normalizeForComparison(label) === normalizedLabel
      }) || null
    )
  }

  function patchHubSwitcherRowColors(hubs) {
    const menuRows = document.querySelectorAll(HUB_MENU_ROW_SELECTOR)
    if (!menuRows.length) {
      return
    }

    menuRows.forEach((menuRow) => {
      const hubKey = resolveHubKeyForMenuRow(menuRow, hubs)
      if (!hubKey || isExcludedHub(hubKey)) {
        menuRow.style.removeProperty("--hub-row-color")
        return
      }

      const hubTheme = hubs[hubKey]
      if (hubTheme?.color) {
        menuRow.style.setProperty("--hub-row-color", `rgb(${hubTheme.color})`)
      } else {
        menuRow.style.removeProperty("--hub-row-color")
      }
    })
  }

  function schedulePatchHubSwitcherRowColors() {
    if (patchHubRowsDebounceTimer) {
      window.clearTimeout(patchHubRowsDebounceTimer)
    }

    patchHubRowsDebounceTimer = window.setTimeout(() => {
      patchHubSwitcherRowColors(cachedHubs)
      patchHubRowsDebounceTimer = null
    }, 60)
  }

  function refreshCachedHubsAndPatch() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      cachedHubs = settings.themingHubs || {}
      if (!settings.themingEnabled) {
        return
      }
      schedulePatchHubSwitcherRowColors()
    })
  }

  function initObserver() {
    if (!document.body) {
      return
    }

    const observer = new MutationObserver(() => {
      schedulePatchHubSwitcherRowColors()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  refreshCachedHubsAndPatch()
  initObserver()

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") {
      return
    }

    if (changes.themingEnabled) {
      if (!changes.themingEnabled.newValue) {
        cachedHubs = {}
      } else {
        refreshCachedHubsAndPatch()
      }
      return
    }

    if (changes.themingHubs) {
      cachedHubs = changes.themingHubs.newValue || {}
      schedulePatchHubSwitcherRowColors()
    }
  })
})()
