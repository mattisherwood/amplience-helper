;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    flowFilter: true,
  }

  let flowFilterEnabled = false
  let resolvedUsername = ""
  let initials = ""
  let usernameLookupInFlight = false
  let initialsWaitAttempts = 0

  const MAX_INITIALS_WAIT_ATTEMPTS = 20
  const INITIALS_WAIT_RETRY_INTERVAL = 250

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

  function applyFlowTextareaPlaceholder() {
    const textarea = document.querySelector(
      '[data-testid="content-form:textarea"]',
    )
    if (!textarea) {
      return false
    }

    textarea.setAttribute(
      "placeholder",
      "Enter flow details here, e.g. [Author] Flow title #tag1 #tag2",
    )
    return true
  }

  function watchForFlowTextarea() {
    if (applyFlowTextareaPlaceholder()) {
      return
    }

    const modalObserver = new MutationObserver((_, observer) => {
      if (!applyFlowTextareaPlaceholder()) {
        return
      }

      observer.disconnect()
    })

    modalObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  function bindCreateFlowButton() {
    const createNewButton = document.querySelector(
      '[data-testid="add-content-flow"]',
    )
    if (!createNewButton || createNewButton.dataset.flowPlaceholderBound) {
      return
    }

    createNewButton.dataset.flowPlaceholderBound = "true"
    createNewButton.addEventListener("click", watchForFlowTextarea)
  }

  async function injectFlowsFilter() {
    if (!resolvedUsername && !usernameLookupInFlight) {
      usernameLookupInFlight = true
      try {
        const username = await getUsername()
        if (username) {
          resolvedUsername = username
          initials = username
            .split(" ")
            .map((n) => n[0])
            .join("")
          initialsWaitAttempts = 0
        } else {
          console.error("Could not resolve username")
        }
      } catch (error) {
        console.error("Error resolving username:", error)
      } finally {
        usernameLookupInFlight = false
      }
    }

    if (!initials) {
      if (initialsWaitAttempts < MAX_INITIALS_WAIT_ATTEMPTS) {
        initialsWaitAttempts += 1
        window.setTimeout(() => {
          if (flowFilterEnabled) {
            injectFlowsFilter()
          }
        }, INITIALS_WAIT_RETRY_INTERVAL)
      }
      return
    }

    const flowsPanel = document.querySelector(
      '[id^="mantine-"][id$="-panel-flows"]',
    )
    if (!flowsPanel) {
      return
    }

    bindCreateFlowButton()

    if (flowsPanel.querySelector("#flow-filter")) {
      return
    }

    const wrapper = document.createElement("div")
    wrapper.id = "flow-filter-wrapper"

    const searchInput = document.createElement("input")
    searchInput.className = "mantine-Input-input mantine-Select-input"
    searchInput.setAttribute("data-variant", "default")
    searchInput.setAttribute("tabindex", "0")
    searchInput.setAttribute("placeholder", "Filter Flows")
    searchInput.setAttribute("autocomplete", "off")
    searchInput.setAttribute("aria-invalid", "false")
    searchInput.id = "flow-filter"
    searchInput.value = ""

    const clearButton = document.createElement("button")
    clearButton.className = "flow-filter-clear"
    clearButton.innerHTML = "×"
    clearButton.setAttribute("type", "button")
    clearButton.setAttribute("aria-label", "Clear filter")

    const mineFilterWrapper = document.createElement("label")
    mineFilterWrapper.className = "flow-filter-mine-toggle"

    const mineFilterLabel = document.createElement("span")
    mineFilterLabel.className = "flow-filter-mine-label"
    mineFilterLabel.textContent = "My flows"

    const mineFilterInput = document.createElement("input")
    mineFilterInput.type = "checkbox"
    mineFilterInput.className = "flow-filter-mine-input"
    mineFilterInput.checked = false
    mineFilterInput.setAttribute("aria-label", "Only show my flows")

    const mineFilterSlider = document.createElement("span")
    mineFilterSlider.className = "flow-filter-mine-slider"

    mineFilterWrapper.appendChild(mineFilterLabel)
    mineFilterWrapper.appendChild(mineFilterInput)
    mineFilterWrapper.appendChild(mineFilterSlider)

    const searchWrapper = document.createElement("div")
    searchWrapper.className = "flow-filter-search-wrapper"
    searchWrapper.appendChild(searchInput)
    searchWrapper.appendChild(clearButton)

    const tagFilters = document.createElement("div")
    tagFilters.className = "flow-filter-tag-filters"

    wrapper.appendChild(searchWrapper)
    wrapper.appendChild(mineFilterWrapper)
    wrapper.appendChild(tagFilters)
    flowsPanel.insertAdjacentElement("afterbegin", wrapper)

    const contentContainer = wrapper.nextElementSibling
    if (!contentContainer) {
      return
    }

    const selectedTags = new Set()

    function parseFlowData(flowElement) {
      const p = flowElement.querySelector("p")
      if (!p) return

      const text = p.textContent.trim()
      const authorMatch = text.match(/^\[([^\]]+)\]/)
      const author = authorMatch ? authorMatch[1] : ""
      const tags = [...text.matchAll(/#(\w+)/g)].map((m) => m[1])
      const title = text
        .replace(/^\[[^\]]+\]\s*/, "")
        .replace(/#\w+/g, "")
        .trim()

      return { author, title, tags }
    }

    const MAX_PARSE_ATTEMPTS = 20
    const PARSE_RETRY_INTERVAL = 250

    function decorateFlow(flow) {
      const { author, title, tags } = parseFlowData(flow)
      const isMine = author && author === initials

      flow.dataset.flowAuthor = author
      flow.dataset.flowTags = tags.join("|")
      flow.dataset.flowTitle = title
      flow.dataset.isMine = isMine

      flow.classList.add("flow-card")
      flow.dataset.flowParsed = "true"

      const stage = flow.children[0].children[0].children[0]

      // Add a little circle badge with the author name
      if (author) {
        const authorColor = createHexColorFromString(author, {
          shade: "light",
          threshold: 200,
        })
        const authorBadge = document.createElement("div")
        authorBadge.className = "author-badge"
        authorBadge.textContent = author
        authorBadge.style.backgroundColor = authorColor
        authorBadge.style.borderColor = isMine
          ? "var(--mantine-primary-color-filled)"
          : undefined
        stage.appendChild(authorBadge)
      }

      // Append the tags
      if (tags.length) {
        const tagsContainer = document.createElement("div")
        tagsContainer.className = "tags"
        tags.forEach((tag) => {
          const tagColor = createHexColorFromString(tag, { shade: "dark" })
          const tagEl = document.createElement("div")
          tagEl.className = "tag"
          tagEl.textContent = `#${tag}`
          tagEl.style.backgroundColor = tagColor
          tagsContainer.appendChild(tagEl)
        })
        stage.appendChild(tagsContainer)
      }

      // Replace the content of the first p element with the title only (essentially removing the author and tags)
      const p = flow.querySelector("p")
      if (p && title) {
        p.textContent = title
      }
    }

    function parseAndDecorateFlows(attempt = 0) {
      const unparsed = Array.from(contentContainer.children).filter(
        (child) => !child.dataset.flowParsed,
      )
      const ready = unparsed.filter((flow) => flow.querySelector("p"))

      if (ready.length === 0) {
        if (attempt < MAX_PARSE_ATTEMPTS) {
          setTimeout(
            () => parseAndDecorateFlows(attempt + 1),
            PARSE_RETRY_INTERVAL,
          )
        }
        return
      }

      ready.forEach(decorateFlow)
      applyFilters()
    }

    parseAndDecorateFlows()

    function getFlowTags(flowElement) {
      const flowTags = flowElement.dataset.flowTags || ""
      return flowTags ? flowTags.split("|").filter(Boolean) : []
    }

    function renderTagFilters(tags) {
      const tagsToRender = Array.from(new Set([...tags, ...selectedTags])).sort(
        (a, b) => a.localeCompare(b),
      )

      tagFilters.innerHTML = ""
      tagFilters.hidden = tagsToRender.length === 0

      for (const tag of tagsToRender) {
        const tagButton = document.createElement("button")
        tagButton.type = "button"
        tagButton.className = "flow-filter-tag-chip"
        tagButton.textContent = `#${tag}`
        tagButton.dataset.tag = tag
        tagButton.style.setProperty(
          "--tag-color",
          createHexColorFromString(tag, { shade: "dark" }),
        )

        if (selectedTags.has(tag)) {
          tagButton.classList.add("is-selected")
        }

        tagButton.addEventListener("click", () => {
          if (selectedTags.has(tag)) {
            selectedTags.delete(tag)
          } else {
            selectedTags.add(tag)
          }

          applyFilters()
        })

        tagFilters.appendChild(tagButton)
      }
    }

    function applyFilters() {
      const filterValue = searchInput.value.toLowerCase().trim()
      const onlyMine = mineFilterInput.checked
      const children = Array.from(contentContainer.children)
      const availableTags = new Set()

      for (const child of children) {
        const text = child.textContent.toLowerCase()
        const matchesSearch = !filterValue || text.includes(filterValue)
        const isMine = child.dataset.isMine === "true"
        const matchesMine = !onlyMine || isMine

        if (matchesSearch && matchesMine) {
          for (const tag of getFlowTags(child)) {
            availableTags.add(tag)
          }
        }
      }

      renderTagFilters(availableTags)

      for (const child of children) {
        const text = child.textContent.toLowerCase()
        const matchesSearch = !filterValue || text.includes(filterValue)
        const isMine = child.dataset.isMine === "true"
        const matchesMine = !onlyMine || isMine
        const flowTags = getFlowTags(child)
        const matchesTags =
          selectedTags.size === 0 ||
          flowTags.some((tag) => selectedTags.has(tag))

        if (matchesSearch && matchesMine && matchesTags) {
          child.removeAttribute("data-visibility")
        } else {
          child.setAttribute("data-visibility", "hidden")
        }
      }
    }

    function updateClearButton() {
      if (searchInput.value.trim()) {
        clearButton.classList.add("visible")
        return
      }

      clearButton.classList.remove("visible")
    }

    clearButton.addEventListener("click", () => {
      searchInput.value = ""
      updateClearButton()
      applyFilters()
    })

    let debounceTimer
    searchInput.addEventListener("input", () => {
      updateClearButton()
      clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        applyFilters()
      }, 100)
    })

    mineFilterInput.addEventListener("change", () => {
      applyFilters()
    })

    updateClearButton()
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
