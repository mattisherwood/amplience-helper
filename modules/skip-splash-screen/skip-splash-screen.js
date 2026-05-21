;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    skipSplashScreenEnabled: false,
  }

  const MAX_ATTEMPTS = 20
  const RETRY_DELAY_MS = 300

  let enabled = false
  let clickAttempts = 0
  let clickInterval = null
  let mutationObserver = null
  let hasClickedForCurrentVisit = false
  let wasOnLoginRoute = false

  function isLoginRoute() {
    return window.location.hash === "#/login"
  }

  function getLoginButton() {
    const button = document.querySelector(".login-button")

    if (!button || button.disabled) {
      return null
    }

    return button
  }

  function stopRetryLoop() {
    if (!clickInterval) {
      return
    }

    clearInterval(clickInterval)
    clickInterval = null
  }

  function tryClickLoginButton() {
    if (!enabled || !isLoginRoute() || hasClickedForCurrentVisit) {
      stopRetryLoop()
      return false
    }

    const loginButton = getLoginButton()

    if (loginButton) {
      hasClickedForCurrentVisit = true
      stopRetryLoop()
      loginButton.click()
      return true
    }

    clickAttempts += 1
    if (clickAttempts >= MAX_ATTEMPTS) {
      stopRetryLoop()
    }

    return false
  }

  function startRetryLoop() {
    if (!enabled || !isLoginRoute() || hasClickedForCurrentVisit) {
      return
    }

    clickAttempts = 0

    if (tryClickLoginButton()) {
      return
    }

    stopRetryLoop()
    clickInterval = window.setInterval(tryClickLoginButton, RETRY_DELAY_MS)
  }

  function handleRouteState() {
    const onLoginRoute = isLoginRoute()

    if (!onLoginRoute) {
      wasOnLoginRoute = false
      hasClickedForCurrentVisit = false
      stopRetryLoop()
      return
    }

    if (!wasOnLoginRoute) {
      hasClickedForCurrentVisit = false
    }

    wasOnLoginRoute = true
    startRetryLoop()
  }

  function onRouteChange() {
    if (!enabled) {
      return
    }

    handleRouteState()
  }

  function startSkipSplashScreen() {
    if (enabled) {
      return
    }

    enabled = true
    wasOnLoginRoute = false
    hasClickedForCurrentVisit = false

    window.addEventListener("hashchange", onRouteChange)
    window.addEventListener("popstate", onRouteChange)

    mutationObserver = new MutationObserver(() => {
      if (!enabled || hasClickedForCurrentVisit || !isLoginRoute()) {
        return
      }

      tryClickLoginButton()
    })
    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })

    handleRouteState()
  }

  function stopSkipSplashScreen() {
    enabled = false
    wasOnLoginRoute = false
    hasClickedForCurrentVisit = false
    stopRetryLoop()

    window.removeEventListener("hashchange", onRouteChange)
    window.removeEventListener("popstate", onRouteChange)

    if (!mutationObserver) {
      return
    }

    mutationObserver.disconnect()
    mutationObserver = null
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (settings.skipSplashScreenEnabled) {
      startSkipSplashScreen()
    }
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.skipSplashScreenEnabled) {
      return
    }

    if (changes.skipSplashScreenEnabled.newValue) {
      startSkipSplashScreen()
      return
    }

    stopSkipSplashScreen()
  })
})()
