;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    flowFilter: true,
  }

  let flowFilterEnabled = false

  function removeFlowsFilter() {
    const wrapper = document.querySelector("#flow-filter-wrapper")
    if (wrapper) {
      wrapper.remove()
    }

    const hiddenElements = document.querySelectorAll(
      '[data-visibility="hidden"]',
    )
    hiddenElements.forEach((element) =>
      element.removeAttribute("data-visibility"),
    )
  }

  function injectFlowsFilter() {
    const flowsPanel = document.querySelector(
      '[id^="mantine-"][id$="-panel-flows"]',
    )
    if (!flowsPanel) {
      return
    }

    if (flowsPanel.querySelector("#flow-filter")) {
      return
    }

    if (!document.getElementById("flow-filter-css")) {
      const style = document.createElement("style")
      style.id = "flow-filter-css"
      style.textContent = `
        [data-visibility="hidden"] { display: none !important; }
        #flow-filter-wrapper {
          position: relative;
          width: 100%;
          max-width: 500px;
        }
        #flow-filter {
          width: 100%;
          padding: .5rem 2.5rem .5rem .75rem;
          border: .0625rem solid #B4C5FC;
          border-radius: .5rem;
          font-size: .875rem;
          font-weight: 400;
          color: #002c42;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          box-sizing: border-box;
          line-height: 1.5rem;
          min-height: 2.5rem;
        }
        #flow-filter::placeholder {
          color: var(--mantine-color-placeholder);
        }
        #flow-filter:focus {
          outline: none;
          border-color: #0374DD;
        }
        #flow-filter-clear {
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          width: 1.5rem;
          height: 1.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
          color: #6c757d;
          font-size: 1.25rem;
          line-height: 1;
          padding: 0;
          border-radius: 0.25rem;
        }
        #flow-filter-clear:hover {
          background-color: rgba(0, 0, 0, 0.05);
          color: #002c42;
        }
        #flow-filter-clear.visible {
          display: flex;
        }
      `
      document.head.appendChild(style)
    }

    const wrapper = document.createElement("div")
    wrapper.id = "flow-filter-wrapper"

    const input = document.createElement("input")
    input.className = "mantine-Input-input mantine-Select-input"
    input.setAttribute("data-variant", "default")
    input.setAttribute("tabindex", "0")
    input.setAttribute("placeholder", "Filter Flows")
    input.setAttribute("autocomplete", "off")
    input.setAttribute("aria-invalid", "false")
    input.id = "flow-filter"
    input.value = ""

    const clearButton = document.createElement("button")
    clearButton.id = "flow-filter-clear"
    clearButton.innerHTML = "×"
    clearButton.setAttribute("type", "button")
    clearButton.setAttribute("aria-label", "Clear filter")

    wrapper.appendChild(input)
    wrapper.appendChild(clearButton)
    flowsPanel.insertAdjacentElement("afterbegin", wrapper)

    const contentContainer = wrapper.nextElementSibling
    if (!contentContainer) {
      return
    }

    function updateClearButton() {
      if (input.value.trim()) {
        clearButton.classList.add("visible")
        return
      }

      clearButton.classList.remove("visible")
    }

    clearButton.addEventListener("click", () => {
      input.value = ""
      updateClearButton()
      input.dispatchEvent(new Event("input"))
    })

    let debounceTimer
    input.addEventListener("input", () => {
      updateClearButton()
      clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        const filterValue = input.value.toLowerCase().trim()
        const children = Array.from(contentContainer.children)

        for (const child of children) {
          const text = child.innerHTML.toLowerCase()
          if (!filterValue || text.includes(filterValue)) {
            child.removeAttribute("data-visibility")
          } else {
            child.setAttribute("data-visibility", "hidden")
          }
        }
      }, 100)
    })
  }

  function applyFlowFilterSetting(enabled) {
    if (!enabled) {
      removeFlowsFilter()
      return
    }

    injectFlowsFilter()
  }

  function setupFlowsPanelObserver() {
    const observer = new MutationObserver(() => {
      if (!flowFilterEnabled) {
        return
      }

      injectFlowsFilter()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    flowFilterEnabled = Boolean(settings.flowFilter)
    applyFlowFilterSetting(flowFilterEnabled)
  })

  setupFlowsPanelObserver()

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.flowFilter) {
      return
    }

    flowFilterEnabled = Boolean(changes.flowFilter.newValue)
    applyFlowFilterSetting(flowFilterEnabled)
  })
})()
