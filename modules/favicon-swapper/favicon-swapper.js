;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    faviconSwapperEnabled: true,
  }

  const RULES = [
    {
      subdirectory: "https://app.amplience.net/content/",
      faviconValue: "modules/favicon-swapper/icons/dynamicContent.ico",
      titleSelector:
        ".am-breadcrumbs__crumb:nth-of-type(2), .am-repositories-selector-label ng-transclude, .repo-selector__btn-wrapper .link-btn",
    },
    {
      subdirectory: "https://app.amplience.net/media/",
      faviconValue: "modules/favicon-swapper/icons/contentHub.ico",
      titleSelector: "",
    },
    {
      subdirectory: "https://app.amplience.net/content-studio/",
      faviconValue: "modules/favicon-swapper/icons/workforce.ico",
      titleSelector: "",
    },
    {
      subdirectory: "https://support.amplience.com/",
      faviconValue: "modules/favicon-swapper/icons/support.ico",
      titleSelector: "",
    },
  ]

  let enabled = false
  let currentUrl = window.location.href
  let activeInterval = null
  let applyRulesTimeout = null
  let originalPageTitle = document.title
  let urlObserver = null

  function swapFavicon(faviconUrl) {
    let link = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.appendChild(link)
    }
    link.href = faviconUrl
  }

  function applyRules() {
    if (!enabled) return
    if (!chrome.runtime?.id) return

    if (activeInterval) {
      clearInterval(activeInterval)
      activeInterval = null
    }

    const url = window.location.href
    for (const rule of RULES) {
      if (url.startsWith(rule.subdirectory)) {
        swapFavicon(chrome.runtime.getURL(rule.faviconValue))

        if (rule.titleSelector) {
          let attempts = 0
          const maxAttempts = 7
          const prependTitle = () => {
            let el = null
            try {
              const nodeList = document.querySelectorAll(rule.titleSelector)
              if (
                nodeList &&
                nodeList.length > 0 &&
                nodeList[0].innerText.trim() !== "…"
              ) {
                el = nodeList[0]
              }
            } catch (e) {}
            if (el && el.innerText) {
              if (!originalPageTitle.startsWith(el.innerText + " |")) {
                document.title = el.innerText + " | " + originalPageTitle
              }
              return true
            }
            return false
          }
          if (!prependTitle()) {
            activeInterval = setInterval(() => {
              attempts++
              if (prependTitle() || attempts >= maxAttempts) {
                clearInterval(activeInterval)
                activeInterval = null
              }
            }, 1000)
          }
        }
        break
      }
    }
  }

  function scheduleApplyRules() {
    if (!chrome.runtime?.id) return
    if (applyRulesTimeout) {
      clearTimeout(applyRulesTimeout)
    }
    applyRulesTimeout = setTimeout(applyRules, 300)
  }

  function onPopState() {
    currentUrl = window.location.href
    scheduleApplyRules()
  }

  function startFaviconSwapper() {
    enabled = true
    originalPageTitle = document.title
    applyRules()

    urlObserver = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href
        scheduleApplyRules()
      }
    })
    urlObserver.observe(document, { subtree: true, childList: true })

    window.addEventListener("popstate", onPopState)
  }

  function stopFaviconSwapper() {
    enabled = false

    if (activeInterval) {
      clearInterval(activeInterval)
      activeInterval = null
    }
    if (applyRulesTimeout) {
      clearTimeout(applyRulesTimeout)
      applyRulesTimeout = null
    }
    if (urlObserver) {
      urlObserver.disconnect()
      urlObserver = null
    }

    window.removeEventListener("popstate", onPopState)
  }

  // Intercept pushState / replaceState for SPA navigation.
  // These patches stay in place permanently; applyRules() checks the `enabled`
  // flag at the top so it no-ops silently when the module is disabled.
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    currentUrl = window.location.href
    scheduleApplyRules()
  }

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args)
    currentUrl = window.location.href
    scheduleApplyRules()
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (settings.faviconSwapperEnabled) {
      startFaviconSwapper()
    }
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.faviconSwapperEnabled) return
    if (changes.faviconSwapperEnabled.newValue) {
      startFaviconSwapper()
    } else {
      stopFaviconSwapper()
    }
  })
})()
