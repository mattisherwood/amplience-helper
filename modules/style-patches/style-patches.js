;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    stylesEnabled: true,
  }

  const WORKFORCE_LINK_SELECTOR =
    '[data-amplience-enhanced-naming-workforce-link="true"]'
  const SWITCHEROO_APP_LIST_SELECTOR = ".switcheroo__primary-applist"

  let switcherooObserver = null

  function createWorkforceLink() {
    const template = document.createElement("template")
    template.innerHTML = `
      <span aria-label="Workforce will be accessible once your organization admin finalizes your account setup" md-labeled-by-tooltip="md-tooltip-16" data-amplience-enhanced-naming-workforce-link="true">
        <a href="https://app.amplience.net/content/" ng-click="disabled ? $event.preventDefault() : null" ng-attr-tabindex="{{ disabled ? -1 : 0 }}" tabindex="0">
          <div class="switcheroo__primary-app switcheroo__primary-app--wf" ng-class="{'switcheroo__primary-app--disabled': disabled, 'switcheroo__primary-app--wf': !disabled}" style="">
            <div class="switcheroo__primary-app-arrow icon-container" amp-icon="ic-arrow-right-grey">
              <svg width="25" height="16" viewBox="0 0 25 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
                <path d="M24.7071 8.70711C25.0976 8.31658 25.0976 7.68342 24.7071 7.29289L18.3431 0.928932C17.9526 0.538408 17.3195 0.538408 16.9289 0.928932C16.5384 1.31946 16.5384 1.95262 16.9289 2.34315L22.5858 8L16.9289 13.6569C16.5384 14.0474 16.5384 14.6805 16.9289 15.0711C17.3195 15.4616 17.9526 15.4616 18.3431 15.0711L24.7071 8.70711ZM0 9H24V7H0V9Z" fill="#737589"></path>
              </svg>
            </div>
            <div class="switcheroo__primary-app-text">
              <p class="switcheroo__primary-app-text-content">Workforce</p>
            </div>
            <div class="switcheroo__primary-app-icon icon-container" amp-icon="ic-wf">
              <svg width="100%" height="100%" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" fit="" preserveAspectRatio="xMidYMid meet" focusable="false">
                <path d="M381.662 116.232C393.431 141.713 400 170.089 400 200C400 310.457 310.457 400 200 400C136.541 400 79.9878 370.443 43.3486 324.348C58.3951 284.599 108.148 226.011 123.43 219.058C176.772 194.789 214.376 267.59 267.086 245.576C311.385 227.074 357.39 151.331 381.662 116.232Z" fill="url(#paint0_linear_4899_131)"></path>
                <path d="M200 0C264.131 0 321.209 30.1857 357.809 77.1221C340.826 116.624 294.35 170.935 279.672 177.614C226.33 201.884 188.725 129.082 136.016 151.096C89.953 170.334 42.0443 251.463 18.6436 284.433C6.68083 258.781 0 230.171 0 200C0 89.5431 89.5431 0 200 0Z" fill="url(#paint1_linear_4899_131)"></path>
                <defs>
                  <linearGradient id="paint0_linear_4899_131" x1="101.768" y1="379.368" x2="337.413" y2="-14.5436" gradientUnits="userSpaceOnUse">
                    <stop offset="0.0472256" stop-color="#7C81FF"></stop>
                    <stop offset="0.485343" stop-color="#9747FF"></stop>
                    <stop offset="1" stop-color="#F8855D"></stop>
                  </linearGradient>
                  <linearGradient id="paint1_linear_4899_131" x1="101.768" y1="379.368" x2="337.413" y2="-14.5436" gradientUnits="userSpaceOnUse">
                    <stop offset="0.0472256" stop-color="#7C81FF"></stop>
                    <stop offset="0.485343" stop-color="#9747FF"></stop>
                    <stop offset="1" stop-color="#F8855D"></stop>
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </a>
      </span>
    `.trim()

    return template.content.firstElementChild
  }

  function insertWorkforceLink() {
    const appList = document.querySelector(SWITCHEROO_APP_LIST_SELECTOR)
    if (!appList) {
      return
    }

    if (appList.querySelector(WORKFORCE_LINK_SELECTOR)) {
      return
    }

    const workforceLink = createWorkforceLink()
    appList.appendChild(workforceLink)
  }

  function removeWorkforceLink() {
    document.querySelectorAll(WORKFORCE_LINK_SELECTOR).forEach((node) => {
      node.remove()
    })
  }

  function startSwitcherooObserver() {
    if (switcherooObserver) {
      return
    }

    switcherooObserver = new MutationObserver(() => {
      insertWorkforceLink()
    })

    switcherooObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  function stopSwitcherooObserver() {
    if (!switcherooObserver) {
      return
    }

    switcherooObserver.disconnect()
    switcherooObserver = null
  }

  function applyStylesSetting(enabled) {
    if (enabled) {
      document.documentElement.setAttribute(
        "data-amplience-style-patches",
        "enabled",
      )

      insertWorkforceLink()
      startSwitcherooObserver()
      return
    }

    document.documentElement.removeAttribute("data-amplience-style-patches")
    stopSwitcherooObserver()
    removeWorkforceLink()
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    applyStylesSetting(settings.stylesEnabled)
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.stylesEnabled) {
      return
    }

    applyStylesSetting(Boolean(changes.stylesEnabled.newValue))
  })
})()
