;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    flowFilter: true,
    myFlowsOnly: false,
  }

  let flowFilterEnabled = false
  let myFlowsOnlyEnabled = false
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

    const archivedSectionEl = document.querySelector("#flow-archived-section")
    if (archivedSectionEl) {
      const archivedContainerEl = archivedSectionEl.querySelector(
        "#flow-archived-container",
      )
      const contentContainerEl = archivedSectionEl.parentElement
      if (archivedContainerEl && contentContainerEl) {
        while (archivedContainerEl.firstChild) {
          contentContainerEl.insertBefore(
            archivedContainerEl.firstChild,
            archivedSectionEl,
          )
        }
      }
      archivedSectionEl.remove()
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
      "e.g. Flow title #tag1 #tag2 [AUTHOR INITIALS]",
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
    mineFilterInput.checked = myFlowsOnlyEnabled
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

    let archivedSection = null
    let archivedContainer = null

    function setupArchivedSection() {
      archivedSection = document.createElement("div")
      archivedSection.id = "flow-archived-section"

      const archivedToggleLabel = document.createElement("span")
      archivedToggleLabel.textContent = "View Archived"

      const archivedToggle = document.createElement("button")
      archivedToggle.id = "flow-archived-toggle"
      archivedToggle.type = "button"
      archivedToggle.setAttribute("aria-expanded", "false")
      archivedToggle.appendChild(archivedToggleLabel)

      archivedContainer = document.createElement("div")
      archivedContainer.id = "flow-archived-container"
      archivedContainer.style.display = "none"

      archivedToggle.addEventListener("click", () => {
        const isExpanded = archivedContainer.style.display !== "none"
        archivedContainer.style.display = isExpanded ? "none" : "grid"
        archivedToggle.classList.toggle("is-expanded", !isExpanded)
        archivedToggle.setAttribute("aria-expanded", String(!isExpanded))
        archivedToggleLabel.textContent = isExpanded
          ? "View Archived"
          : "Hide Archived"
      })

      archivedSection.appendChild(archivedToggle)
      archivedSection.appendChild(archivedContainer)
    }

    setupArchivedSection()

    const selectedTags = new Set()

    function parseFlowData(flowElement) {
      const paragraphs = flowElement.querySelectorAll("p")
      const titleParagraph = paragraphs[0]
      const descriptionParagraph = paragraphs[1]
      if (!titleParagraph) return

      const text = titleParagraph.textContent.trim()
      const descriptionText = descriptionParagraph
        ? descriptionParagraph.textContent.trim()
        : ""
      const isArchived = /\(Archived\)/i.test(text)
      const authorMatch = text.match(/\[([^\]]{1,3})\]/)
      const author = authorMatch ? authorMatch[1] : ""
      const tags = [
        ...text.matchAll(/#([\w-]+)/g),
        ...descriptionText.matchAll(/#([\w-]+)/g),
      ]
        .map((m) => m[1])
        .filter((tag, index, allTags) => allTags.indexOf(tag) === index)
      const title = text
        .replace(/\s*\[[^\]]{1,3}\]\s*/, " ")
        .replace(/#[\w-]+/g, "")
        .replace(/\s*\(Archived\)\s*/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
      const description = descriptionText
        .replace(/#[\w-]+/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()

      return { author, title, description, tags, isArchived }
    }

    const MAX_PARSE_ATTEMPTS = 20
    const PARSE_RETRY_INTERVAL = 250

    function decorateFlow(flow) {
      const { author, title, description, tags, isArchived } =
        parseFlowData(flow)
      const isMine = author && author === initials

      flow.dataset.flowAuthor = author
      flow.dataset.flowTags = tags.join("|")
      flow.dataset.flowTitle = title
      flow.dataset.isMine = isMine
      flow.dataset.isArchived = isArchived

      flow.classList.add("flow-card")
      flow.dataset.flowParsed = "true"

      const cardContent = flow.children[0].children[0].children
      const stage = cardContent[cardContent.length - 1]

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

      const descriptionP = flow.querySelectorAll("p")[1]
      if (descriptionP) {
        descriptionP.textContent = description
      }
    }

    function redistributeArchivedFlows() {
      const toArchive = Array.from(contentContainer.children).filter(
        (child) =>
          child.id !== "flow-archived-section" &&
          child.dataset.isArchived === "true",
      )
      toArchive.forEach((child) => archivedContainer.appendChild(child))

      // Always re-append so the section stays at the end of the flow list
      contentContainer.appendChild(archivedSection)
      archivedSection.hidden = archivedContainer.children.length === 0

      // Set grid layout to match the parent container (deferred until flows are in the DOM)
      if (!archivedContainer.style.gridTemplateColumns) {
        const cs = getComputedStyle(contentContainer)
        archivedContainer.style.gridTemplateColumns = cs.gridTemplateColumns
        archivedContainer.style.gap = cs.gap
      }
    }

    function parseAndDecorateFlows(attempt = 0) {
      const unparsed = Array.from(contentContainer.children).filter(
        (child) =>
          child.id !== "flow-archived-section" && !child.dataset.flowParsed,
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
      redistributeArchivedFlows()
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

    function highlightText(element, phrase) {
      // Walk text nodes and wrap matches in a highlight span
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
      )
      const nodes = []
      let node
      while ((node = walker.nextNode())) {
        nodes.push(node)
      }

      for (const textNode of nodes) {
        const parent = textNode.parentNode
        if (!parent || parent.classList.contains("flow-search-highlight")) {
          continue
        }
        const text = textNode.nodeValue
        const lowerText = text.toLowerCase()
        const idx = lowerText.indexOf(phrase)
        if (idx === -1) continue

        const before = document.createTextNode(text.slice(0, idx))
        const mark = document.createElement("span")
        mark.className = "flow-search-highlight"
        mark.textContent = text.slice(idx, idx + phrase.length)
        const after = document.createTextNode(text.slice(idx + phrase.length))

        parent.insertBefore(before, textNode)
        parent.insertBefore(mark, textNode)
        parent.insertBefore(after, textNode)
        parent.removeChild(textNode)
      }
    }

    function removeHighlights(element) {
      const marks = element.querySelectorAll(".flow-search-highlight")
      for (const mark of marks) {
        const parent = mark.parentNode
        parent.replaceChild(document.createTextNode(mark.textContent), mark)
        parent.normalize()
      }
    }

    function applyFilters() {
      const filterValue = searchInput.value.toLowerCase().trim()
      const onlyMine = mineFilterInput.checked
      const children = Array.from(contentContainer.children).filter(
        (c) => c.id !== "flow-archived-section",
      )
      const archivedChildren = Array.from(archivedContainer.children)
      const availableTags = new Set()

      for (const child of [...children, ...archivedChildren]) {
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

      for (const child of [...children, ...archivedChildren]) {
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

        removeHighlights(child)
        if (filterValue && matchesSearch && matchesMine && matchesTags) {
          highlightText(child, filterValue)
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
      myFlowsOnlyEnabled = mineFilterInput.checked
      chrome.storage.sync.set({ myFlowsOnly: myFlowsOnlyEnabled })
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
    myFlowsOnlyEnabled = Boolean(settings.myFlowsOnly)
    applyFlowFilterSetting(flowFilterEnabled)
  })

  setupFlowsPanelObserver()

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") {
      return
    }

    if (changes.flowFilter) {
      flowFilterEnabled = Boolean(changes.flowFilter.newValue)
      applyFlowFilterSetting(flowFilterEnabled)
    }

    if (changes.myFlowsOnly) {
      myFlowsOnlyEnabled = Boolean(changes.myFlowsOnly.newValue)

      const mineFilterInput = document.querySelector(".flow-filter-mine-input")
      if (mineFilterInput) {
        mineFilterInput.checked = myFlowsOnlyEnabled
        mineFilterInput.dispatchEvent(new Event("change"))
      }
    }
  })
})()
