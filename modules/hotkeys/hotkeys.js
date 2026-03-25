// Amplience Hotkeys - Content Script

const DEFAULT_SETTINGS = {
  hotkeysEnabled: true,
}

// Track whether we're in filter typing mode
let isFilterTypingMode = false
let hotkeysEnabled = false
let isInitialized = false
let initAttempts = 0
let initIntervalId = null
let debounceTimer = null
let pageObserver = null
let removeHelpOverlay = null

// Initialize tooltips when buttons are available
// Use a retry mechanism for initial page load (Angular takes time to render)
const maxInitAttempts = 10 // 10 attempts * 500ms = 5 seconds max

const handleKeydown = (event) => {
  if (!hotkeysEnabled) {
    return
  }

  // Skip all other hotkeys other than return or Ctrl+Cmd keys if user is typing in an input field
  if (
    isTypingInInput() &&
    event.key !== "Enter" &&
    !(event.ctrlKey || event.metaKey)
  )
    return

  if (document.getElementById("hotkey-help-overlay") !== null) return

  // Apply listing-specific hotkeys
  const isInListing = document.querySelector("am-content-item-library") !== null
  if (isInListing) applyListingHotkeys(event)

  // Apply editor-specific hotkeys
  const isInEditor = document.querySelector("am-content-item-editor") !== null
  if (isInEditor) applyEditorHotkeys(event)

  // Apply schema-listing hotkeys
  const isInSchemaListing = document.querySelector("am-schemas-list") !== null
  if (isInSchemaListing) applySchemaListingHotkeys(event)

  // Apply schema-editing hotkeys
  const isInSchemaEditor = document.querySelector("am-schema-editor") !== null
  if (isInSchemaEditor) applySchemaEditorHotkeys(event)

  // Always apply global hotkeys
  applyGlobalHotkeys(event)
}

function startInitializationLoop() {
  initAttempts = 0

  if (initIntervalId) {
    clearInterval(initIntervalId)
  }

  initIntervalId = setInterval(() => {
    initAttempts += 1
    const hasButtons = document.querySelector('[name="mainMenu"]') !== null

    if (hasButtons || initAttempts >= maxInitAttempts) {
      initializeTooltips()
      clearInterval(initIntervalId)
      initIntervalId = null
      setupObserver()
    }
  }, 500)
}

function startHotkeys() {
  hotkeysEnabled = true

  if (isInitialized) {
    return
  }

  isInitialized = true
  document.addEventListener("keydown", handleKeydown)
  startInitializationLoop()
}

function stopHotkeys() {
  hotkeysEnabled = false

  if (!isInitialized) {
    return
  }

  isInitialized = false
  document.removeEventListener("keydown", handleKeydown)

  if (initIntervalId) {
    clearInterval(initIntervalId)
    initIntervalId = null
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  if (pageObserver) {
    pageObserver.disconnect()
    pageObserver = null
  }

  if (removeHelpOverlay) {
    removeHelpOverlay()
  }
}

/*
 * Set up MutationObserver to watch for DOM changes
 * This handles SPA navigation and dynamically loaded content
 */
const setupObserver = () => {
  if (pageObserver) {
    return
  }

  pageObserver = new MutationObserver(() => {
    // Debounce to avoid running too frequently
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      initializeTooltips()
    }, 300)
  })

  // Observe the entire document for changes
  pageObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

/*
 * Initialize tooltips on all relevant buttons
 * This runs on page load to add helpful tooltips showing keyboard shortcuts
 */
const initializeTooltips = () => {
  // Add tooltips for listing page buttons
  addTooltipToButton(".am-browser-close-button", "Close (Esc)")
  addTooltipToButton("am-bulk-assign-users button", "Assign User (A)")
  addTooltipToButton(
    '[am-id="am-content-item-library__create-btn--content"]',
    "Create Content (C)",
  )
  addTooltipToButton('[am-id="am-bulk-action-copy"]', "Duplicate (D)")
  addTooltipToButton(".am-bulk-action-controls__button--archive", "Archive (E)")
  addTooltipToButton(".am-inline-filters__button", "Filters (F)")
  addTooltipToButton("am-bulk-assign-locale button", "Localize (L)")
  addTooltipToButton('[am-id="am-bulk-action-publish"]', "Publish (P)")
  addTooltipToButton(
    ".am-bulk-action-controls__button--unarchive",
    "Unarchive (U)",
  )
  addTooltipToButton(
    '[am-id="planning__sub-nav__grid-button"]',
    "Grid View (V)",
  )
  addTooltipToButton(
    '[am-id="planning__sub-nav__list-button"]',
    "List View (V)",
  )
  addTooltipToButton('[am-id="content-pagination--next"]', "Next Page (→)")
  addTooltipToButton('[am-id="content-pagination--prev"]', "Previous Page (←)")

  // Add tooltips for editor page buttons
  addTooltipToButton(
    '[am-id="am-editor-action-controls__btn--back"]',
    "Back (Esc)",
  )
  addTooltipToButton(".am-workflow-assignee-chooser__btn", "Assign User (A)")
  addTooltipToButton(
    '[am-id="am-editor-action-controls__btn--delivery-key"]',
    "Set Delivery Key (D)",
  )
  addTooltipToButton(
    '[am-id="am-editor-action-controls__btn--archive"], [am-id="am-editor-action-controls__btn--unpublish-and-archive"]',
    "Archive (E)",
  )
  addTooltipToButton(
    '[am-id="am-content-item-editor-toolbar__action--history"] button',
    "History Panel (H)",
  )
  addTooltipToButton(
    '[am-id="am-content-item-editor-toolbar__action--props"] button',
    "Info Panel (I)",
  )
  addTooltipToButton(
    '[am-id="am-editor-action-controls__btn--set-locale"]',
    "Localize (L)",
  )
  addTooltipToButton(
    '[am-id="am-content-item-editor-toolbar__action--usage"] button',
    "Schedule Panel (S)",
  )
  addTooltipToButton(
    '[am-id="am-editor-action-controls__btn--save-as"]',
    "Save As... (Ctrl+Shift+S)",
  )
  addTooltipToButton(
    '[am-id="am-editor-action-controls__btn--save"]',
    "Save (Ctrl+S)",
  )
  addTooltipToButton(
    '[am-id="am-content-item-editor-toolbar__action--vis"] button',
    "Visualization Panel (V)",
  )

  // Add tooltips for global navigation buttons
  const topLevelMenuItems = document.querySelectorAll(
    '[name="mainMenu"] > md-menu-bar > button',
  )
  if (topLevelMenuItems.length >= 4) {
    addTooltipToButtonObject(topLevelMenuItems[0], "Dashboard (1)")
    addTooltipToButtonObject(topLevelMenuItems[1], "Content (2)")
    addTooltipToButtonObject(topLevelMenuItems[2], "Assets (3)")
    addTooltipToButtonObject(topLevelMenuItems[3], "Scheduling (4)")
  }
  const developerMenuItems = document.querySelectorAll(
    ".masthead__mainMenu-button--list .am-masthead-menu__action",
  )
  const developerMenuTooltips = [
    "Content Type Schemas (5)",
    "Content Types (6)",
    "Extensions (7)",
    "Webhooks (8)",
    "Personal Access Tokens (9)",
    "Integrations (0)",
  ]
  developerMenuItems.forEach((item, index) => {
    if (developerMenuTooltips[index]) {
      addTooltipToButtonObject(item, developerMenuTooltips[index])
    }
  })
}

const applyListingHotkeys = (event) => {
  // DELIVERY KEY ENTRY HOTKEYS
  const isDeliveryKeyModalOpen =
    document.querySelector('md-dialog[aria-label="A delivery ..."]') !== null
  if (isDeliveryKeyModalOpen) {
    // ================ ESCAPE =================
    if (event.key === "Escape") {
      clickButton(
        'md-dialog[aria-label="A delivery ..."] [aria-label="Cancel"]',
        event,
      )
    }

    // ================ ENTER =================
    if (event.key === "Enter") {
      clickButton(
        'md-dialog[aria-label="A delivery ..."] [aria-label="Save"]',
        event,
      )
    }

    return
  }

  // FILTER PANEL HOTKEYS
  const isFiltersPanelOpen =
    document.querySelector(".am-inline-filters-overlay__wrapper") !== null
  if (isFiltersPanelOpen) {
    // ================ RETURN / ESCAPE =================
    if (["Enter", "Escape"].includes(event.key)) {
      // If the filters panel is open, close it
      const isFiltersPanelOpen =
        document.querySelector(".am-inline-filters-overlay__wrapper") !== null
      if (isFiltersPanelOpen) {
        clickButton(".am-inline-filters__button", event)
        return
      }
    }

    return
  }

  // CREATE CONTENT PANEL HOTKEYS
  const isCreateContentModalOpen =
    document.querySelector('[aria-label="Choose a content type"]') !== null
  if (isCreateContentModalOpen) {
    // ================ ESCAPE =================
    if (event.key === "Escape") {
      clickButton(".am-browser-close-button", event)
    }

    // ================ CTRL/CMD + F =================
    if (isCtrlOrCmd(event) && ["f", "F"].includes(event.key)) {
      const input = document.querySelector(
        '[aria-label="Choose a content type"] am-search-box input',
      )
      if (input) {
        input.focus()
        event.preventDefault()
        return
      }
    }

    return
  }

  // ================ F2 Rename ================
  if (!isCtrlOrCmd(event) && event.key === "F2") {
    // TODO: If a single item is selected, go to the td on that item's tr with the `am-table__actions` class and click the button inside it.
    if (event.key === "F2") {
      const selectedItems = document.querySelectorAll(
        "am-content-view-list tr.is-selected",
      )
      if (selectedItems.length === 1) {
        const actionsCell = selectedItems[0].querySelector(
          "td.am-table__actions",
        )
        if (actionsCell) {
          const actionButton = actionsCell.querySelector("button")
          if (actionButton) {
            actionButton.click(event)

            setTimeout(() => {
              clickButton('[am-id="am-context-menu__btn--rename"]', event)
              removeClickCatcher()
            }, 100)
          }
        }
      }
      return
    }
  }

  // ================= RETURN =================
  if (event.key === "Enter") {
    // Don't do this custom script if a dialog is open, as it will likely have its own handling for the Enter key
    const isDialogOpen = document.querySelector(".md-dialog-container") !== null
    if (isDialogOpen) return

    // TODO: If a single item is selected, open it
    const selectedItems = document.querySelectorAll(
      "am-content-view-list tr.is-selected",
    )
    if (selectedItems.length === 1) {
      const actionsCell = selectedItems[0].querySelector(
        "td.am-content-view-list__data--label",
      )
      if (actionsCell) {
        const link = actionsCell.querySelector("a")
        if (link) {
          link.click()
        }
      }
    }
  }

  // ================ ESCAPE =================
  if (event.key === "Escape") {
    // Don't do this custom script if a dialog is open, as it will likely have its own handling for the Escape key
    const isDialogOpen = document.querySelector(".md-dialog-container") !== null
    if (isDialogOpen) return

    // Deselect all items
    const selectAllCheckbox = document.querySelector(
      "am-select-all md-checkbox",
    )
    if (selectAllCheckbox) {
      if (selectAllCheckbox.classList.contains("md-indeterminate")) {
        selectAllCheckbox.click()
        event.preventDefault()
      }
      if (selectAllCheckbox.classList.contains("md-checked")) {
        selectAllCheckbox.click()
        event.preventDefault()
        return
      }
    }
  }

  // =================== A ===================
  if (!isCtrlOrCmd(event) && ["a", "A"].includes(event.key)) {
    // Assign User to selected items
    clickButton("am-bulk-assign-users button", event)
    return
  }

  // ============= CTRL/CMD + A ==============
  if (isCtrlOrCmd(event) && ["a", "A"].includes(event.key)) {
    // Select all items
    const selectAllCheckbox = document.querySelector(
      "am-select-all md-checkbox",
    )
    if (
      selectAllCheckbox &&
      selectAllCheckbox.classList.contains("md-checked") === false
    ) {
      selectAllCheckbox.click()
      event.preventDefault() // Prevent default select all behavior
    }
  }

  // =================== C ===================
  if (!isCtrlOrCmd(event) && ["c", "C"].includes(event.key)) {
    // If the "Create new content item" modal is already open, do nothing
    const createContentModalIsOpen =
      document.querySelector('[aria-label="Choose a content type"]') !== null
    if (createContentModalIsOpen) return

    // Open the "Create new content item" modal
    clickButton('[am-id="am-content-item-library__create-btn--content"]', event)

    // If the search input has loaded, focus on it to allow immediate searching for content types
    // Otherwise keep checking every 100ms for up to 5 seconds in case the modal takes some time to load
    const focusSearchInput = () => {
      const searchInput = document.querySelector(
        '[aria-label="Choose a content type"] am-search-box input',
      )
      if (searchInput) {
        searchInput.focus()
      } else if (Date.now() - startTime < 5000) {
        setTimeout(focusSearchInput, 100)
      }
    }
    const startTime = Date.now()
    focusSearchInput()

    return
  }

  // =================== D ===================
  if (!isCtrlOrCmd(event) && ["d", "D"].includes(event.key)) {
    // Duplicate selected items
    clickButton('[am-id="am-bulk-action-copy"]', event)
    return
  }

  // =================== E ===================
  if (!isCtrlOrCmd(event) && ["e", "E"].includes(event.key)) {
    // Archive selected items
    clickButton(".am-bulk-action-controls__button--archive", event)
    return
  }

  // =================== F ===================
  if (!isCtrlOrCmd(event) && ["f", "F"].includes(event.key)) {
    // Open/Close filters panel
    clickButton(".am-inline-filters__button", event)

    const contentTypeFilterOptions = document.querySelectorAll(
      ".am-inline-filters-overlay__group-wrapper:first-of-type am-inline-filters-facet-option",
    )
    let filterString = ""
    let filterResetTimer = null

    // Once the filters are open, listen for 5 seconds to see if any further keys are pressed
    // If the user types one or more A-Z keys (other than F) within then it checks for filter options starting with that string and clicks on them to quickly filter by that content type
    // e.g. 'P' would filter by 'product carousel' and 'page' content types if those options are available
    // e.g. 'Pa' would filter by 'page' content types but not 'product carousel'
    if (contentTypeFilterOptions.length > 0) {
      const filterKeyListener = (event) => {
        if (isCtrlOrCmd(event) || event.key === "F") return

        if (/^[a-zA-Z]$/.test(event.key)) {
          // Clear any existing reset timer
          clearTimeout(filterResetTimer)

          filterString += event.key.toLowerCase()

          // Check for options that match the filter string and click the first one
          for (const option of contentTypeFilterOptions) {
            const optionLabel = option.querySelector(
              "am-inline-filters-facet-option-label ng-transclude",
            )
            const optionText = optionLabel.textContent.toLowerCase()
            const checkbox = option.querySelector("md-checkbox")
            if (optionText.startsWith(filterString)) {
              if (checkbox && !checkbox.classList.contains("md-checked"))
                checkbox.click()
            } else if (checkbox && checkbox.classList.contains("md-checked")) {
              checkbox.click()
            }
          }

          // Set a timer to reset the filter string if no key is pressed within 1 second
          filterResetTimer = setTimeout(() => {
            filterString = ""
          }, 1000)
        } else {
          // If user types a non A-Z key, reset the filter string
          clearTimeout(filterResetTimer)
          filterString = ""
        }
      }

      document.addEventListener("keydown", filterKeyListener)

      // Remove this listener on the closing of the filter panel
      const removeFilterKeyListener = () => {
        clearTimeout(filterResetTimer)
        document.removeEventListener("keydown", filterKeyListener)
        document.removeEventListener(
          "keydown",
          removeFilterkeyCancellationListener,
        )
        document.removeEventListener("click", handleClickOutside)
      }
      const removeFilterkeyCancellationListener = (event) => {
        if (["Enter", "Escape"].includes(event.key)) {
          removeFilterKeyListener()
        }
      }
      const handleClickOutside = (event) => {
        // Only remove listeners if clicking outside the filter panel
        const filterPanel = document.querySelector(".am-inline-filters-overlay")
        if (filterPanel && !filterPanel.contains(event.target)) {
          removeFilterKeyListener()
        }
      }
      // Filter panel can be closed by the Enter or escape keys (handled above) or by clicking outside the panel, so listen for clicks on the document to catch that and remove the filter key listener
      document.addEventListener("click", handleClickOutside)
      document.addEventListener("keydown", removeFilterkeyCancellationListener)
    }

    return
  }

  // ============= CTRL/CMD + F ==============
  if (isCtrlOrCmd(event) && ["f", "F"].includes(event.key)) {
    // Focus search input
    // Find the modal search input if that's open, or fall back to global search input
    const input = document.querySelector("am-search-box input")
    if (input) {
      input.focus()
      event.preventDefault()
      return
    }
  }

  // =================== L ===================
  if (!isCtrlOrCmd(event) && ["l", "L"].includes(event.key)) {
    // Localize selected items
    clickButton("am-bulk-assign-locale button", event)
    return
  }

  // =================== P ===================
  if (!isCtrlOrCmd(event) && ["p", "P"].includes(event.key)) {
    // Publish selected items
    clickButton('[am-id="am-bulk-action-publish"]', event)
    return
  }

  // =================== U ===================
  if (!isCtrlOrCmd(event) && ["u", "U"].includes(event.key)) {
    // Unarchive selected items
    if (clickButton(".am-bulk-action-controls__button--unarchive", event))
      return
  }

  // =================== V ===================
  if (!isCtrlOrCmd(event) && ["v", "V"].includes(event.key)) {
    // Toggle view mode between list and grid
    const gridButton = document.querySelector(
      '[am-id="planning__sub-nav__grid-button"]',
    )
    const listButton = document.querySelector(
      '[am-id="planning__sub-nav__list-button"]',
    )
    if (gridButton && listButton) {
      const isGridView = gridButton.classList.contains("active")
      if (isGridView) {
        listButton.click()
      } else {
        gridButton.click()
      }
      event.preventDefault()
      return
    }
  }

  // =================== → ===================
  if (!isCtrlOrCmd && event.key === "ArrowRight") {
    // Go to next page of items
    clickButton('[am-id="content-pagination--next"]', event)
    return
  }

  // =================== ← ===================
  if (!isCtrlOrCmd && event.key === "ArrowLeft") {
    // Go to previous page of items
    clickButton('[am-id="content-pagination--prev"]', event)
    return
  }
}

const applyEditorHotkeys = (event) => {
  // ================ F2 Rename ================
  if (!isCtrlOrCmd(event) && event.key === "F2") {
    clickButton('[am-id="am-editor-action-controls__btn--rename"]', event)
    return
  }

  // ================ ESCAPE =================
  if (event.key === "Escape") {
    // Cancel editing and go back
    clickButton('[am-id="am-editor-action-controls__btn--back"]', event)
    return
  }

  // =================== A ===================
  if (!isCtrlOrCmd(event) && ["a", "A"].includes(event.key)) {
    // Assign User to current item
    clickButton(".am-workflow-assignee-chooser__btn", event)
    return
  }

  // =================== D ===================
  if (!isCtrlOrCmd(event) && ["d", "D"].includes(event.key)) {
    // Set delivery key
    clickButton('[am-id="am-editor-action-controls__btn--delivery-key"]', event)
    return
  }

  // =================== E ===================
  if (!isCtrlOrCmd(event) && ["e", "E"].includes(event.key)) {
    // Archive current item
    clickButton(
      '[am-id="am-editor-action-controls__btn--archive"], [am-id="am-editor-action-controls__btn--unpublish-and-archive"]',
      event,
    )
    return
  }

  // =================== H ===================
  if (!isCtrlOrCmd(event) && ["h", "H"].includes(event.key)) {
    // Show/hide History panel
    clickButton(
      '[am-id="am-content-item-editor-toolbar__action--history"] button',
      event,
    )
    return
  }

  // =================== I ===================
  if (!isCtrlOrCmd(event) && ["i", "I"].includes(event.key)) {
    // Show/hide Info panel
    clickButton(
      '[am-id="am-content-item-editor-toolbar__action--props"] button',
      event,
    )
    return
  }

  // =================== L ===================
  if (!isCtrlOrCmd(event) && ["l", "L"].includes(event.key)) {
    // Localize current item
    clickButton('[am-id="am-editor-action-controls__btn--set-locale"]', event)
    return
  }

  // =================== P ===================
  if (!isCtrlOrCmd(event) && ["p", "P"].includes(event.key)) {
    // Publish current item
    clickButton('[am-id="am-bulk-action-publish"]', event)
    return
  }

  // =================== S ===================
  if (!isCtrlOrCmd(event) && ["s", "S"].includes(event.key)) {
    // Show/hide Schedule panel
    clickButton(
      '[am-id="am-content-item-editor-toolbar__action--usage"] button',
      event,
    )
    return
  }

  // ============= CTRL/CMD + S ==============
  if (isCtrlOrCmd(event) && ["s", "S"].includes(event.key)) {
    // Save as a new item if shift is also pressed
    if (event.shiftKey) {
      clickButton('[am-id="am-editor-action-controls__btn--save-as"]', event)
      return
    }

    // Otherwise save changes to current item
    clickButton('[am-id="am-editor-action-controls__btn--save"]', event)
    return
  }

  // =================== V ===================
  if (!isCtrlOrCmd(event) && ["v", "V"].includes(event.key)) {
    // Show/hide Visualization panel
    clickButton(
      '[am-id="am-content-item-editor-toolbar__action--vis"] button',
      event,
    )
    return
  }
}

const applySchemaListingHotkeys = (event) => {
  // ================ CTRL/CMD + F =================
  if (isCtrlOrCmd(event) && ["f", "F"].includes(event.key)) {
    // Focus search input
    const input = document.querySelector("am-search-box input")
    if (input) {
      input.focus()
      event.preventDefault()
      return
    }
  }

  // =================== → ===================
  if (event.key === "ArrowRight") {
    // Go to next page of items
    clickButton(".am-pagination__link--next", event)
    return
  }

  // =================== ← ===================
  if (event.key === "ArrowLeft") {
    // Go to previous page of items
    clickButton("am-pagination__link--prev", event)
    return
  }
}

const applySchemaEditorHotkeys = (event) => {
  // ================ ESCAPE =================
  if (event.key === "Escape") {
    // Cancel editing and go back
    clickButton(".am-schema-editor-actions__back-button", event)
    return
  }
}

const applyGlobalHotkeys = (event) => {
  // =================== ? ===================
  if (!isCtrlOrCmd(event) && event.key === "?") {
    // Show help splash-screen overlay
    createHelpOverlay()
    event.preventDefault()
    return
  }

  // ================ F1 Open Help ================
  if (event.key === "F1") {
    // Open the documentation in new tab
    clickButton('[data-testid="masthead-help-icon"]', event)
  }

  // =================== Numbers 1-9 and 0 ===================
  if (!isCtrlOrCmd(event) && /^[0-9]$/.test(event.key)) {
    const numberKey = parseInt(event.key, 10)
    const index = numberKey === 0 ? 9 : numberKey - 1
    const topLevelMenuItems = document.querySelectorAll(
      '[name="mainMenu"] > md-menu-bar > button',
    )
    // Numbers 1-4 open the items on the top-level menu
    if (index >= 0 && index <= 3) {
      if (topLevelMenuItems[index]) {
        topLevelMenuItems[index].click()
        event.preventDefault()
      }
      return
    }
    // Numbers 5-9 and 0 open the menu items hidden in the "Developer" menu
    if (index >= 4 && index <= 9) {
      const developerMenuItems = document.querySelectorAll(
        ".masthead__mainMenu-button--list .am-masthead-menu__action",
      )
      const developerMenuIndex = index - 4
      if (developerMenuItems[developerMenuIndex]) {
        developerMenuItems[developerMenuIndex].click()
        event.preventDefault()
      }
    }
  }
}

/*
 * Helper function to check if user is typing in an input field
 * @returns {boolean} - True if the active element is an input, textarea, or contenteditable
 */
const isTypingInInput = () => {
  const activeElement = document.activeElement
  if (!activeElement) return false

  const tagName = activeElement.tagName.toLowerCase()
  const isInput = tagName === "input" || tagName === "textarea"
  const isContentEditable = activeElement.isContentEditable

  return isInput || isContentEditable
}

const addTooltipToButton = (selector, tooltipText) => {
  const button = document.querySelector(selector)
  if (button) {
    // if ((currentTitle = button.getAttribute("title"))) {
    //   button.setAttribute("title", `${currentTitle} ${tooltipText}`)
    // } else {
    button.setAttribute("title", tooltipText)
    // }
  }
}

const addTooltipToButtonObject = (button, tooltipText) => {
  if (button) {
    // if ((currentTitle = button.getAttribute("title"))) {
    //   button.setAttribute("title", `${currentTitle} ${tooltipText}`)
    // } else {
    button.setAttribute("title", tooltipText)
    // }
  }
}

/*
 * Click a button specified by the selector if it exists and is not disabled
 * @param {string} selector - The CSS selector for the button
 * @param {KeyboardEvent} event - The keyboard event to prevent default action
 * @returns {boolean} - True if the button was clicked, false otherwise
 */
const clickButton = (selector, event) => {
  const button = document.querySelector(selector)
  if (button && !button.classList.contains("disabled")) {
    button.click()
    event.preventDefault()
    return true
  }
  return false
}

/*
 * Check if Ctrl (Windows/Linux) or Cmd (Mac) key is pressed
 * @param {KeyboardEvent} event - The keyboard event
 * @returns {boolean} - True if Ctrl or Cmd is pressed, false otherwise
 */
const isCtrlOrCmd = (event) => event.ctrlKey || event.metaKey

/*
 * Create and display a help overlay with hotkey information
 */
const createHelpOverlay = () => {
  const overlay = document.createElement("div")
  overlay.id = "hotkey-help-overlay"
  overlay.innerHTML = `<style>
    #hotkey-help-overlay {
        position: fixed;
        top: 50%;
        left: 50%;
        max-width: 80%;
        max-height: calc(100vh - 80px);
        padding: 20px 40px;
        background-color: rgba(0, 0, 0, 0.8);
        border-radius: 10px;
        color: #fff;
        font-size: 16px;
        text-align: center;
        z-index: 10000;
        transform: translate(-50%, -50%);
        overflow: auto;

        .cols {
            display: flex;
            flex-direction: column;
            gap: 20px;
            width: max-content;
            max-width: 100%;

            div {
                border: solid 1px;
                border-radius: 10px;
                overflow: hidden;
            }
        }

        h3 {
            margin: 0;
            padding: 10px;
            background-color: #fff;
            color: #000;
        }

        h4 {
            text-align: right;
            border-bottom: solid 1px;
            color: #fff;
            padding-block: 5px;
            margin: 10px 20px 0;
        }

        dl {
            display: grid;
            position: relative;
            grid-template-columns: auto auto;
            margin: 5px 20px 20px;
        }

        dt,
        dd {
            padding: 5px 0;
        }

        dt {
            text-align: left;
            font-weight: bold;

            &:not(:first-child)::before {
                content: "";
                display: block;
                position: absolute;
                border-bottom: solid 1px #666;
                width: 100%;
                left: 0;
                margin-top: -5px;
            }
        }

        dd {
            text-align: right;
        }

        .caveat {
          color: #ccc;
          display: block;
          text-align: right;
          margin: -1em 20px 0;
          box-sizing: border-box;
          font-size: 0.8em;
          line-height: 1;
        }

        .closeHelpText {
          color: #ccc;
        }
    }

    @media (min-width: 700px) {
        #hotkey-help-overlay .cols {
            flex-direction: row;

            div {
                width: calc(33% - (40px / 3));
            }
        }
    }
</style>
<h2>Amplience Hotkeys</h2>
<div class="cols">
    <div>
        <h3>Global</h3>
        <h4>Navigation</h4>
        <dl>
            <dt>1</dt>
            <dd>Dashboard</dd>
            <dt>2</dt>
            <dd>Content</dd>
            <dt>3</dt>
            <dd>Assets</dd>
            <dt>4</dt>
            <dd>Scheduling</dd>
            <dt>5</dt>
            <dd>Content Type Schemas</dd>
            <dt>6</dt>
            <dd>Content Types</dd>
            <dt>7</dt>
            <dd>Extensions</dd>
            <dt>8</dt>
            <dd>Webhooks</dd>
            <dt>9</dt>
            <dd>Personal Access Tokens</dd>
            <dt>0</dt>
            <dd>Integrations</dd>
        </dl>
        <h4>Help</h4>
        <dl>
            <dt>F1</dt>
            <dd>Open Docs (in new tab)</dd>
            <dt>?</dt>
            <dd>Show this hotkeys cheat sheet</dd>
        </dl>
    </div>
    <div>
        <h3>Listing Page</h3>
        <h4>Actions</h4>
        <dl>
            <dt>F2</dt>
            <dd>Rename selected item*</dd>
            <dt>A</dt>
            <dd>Assign a user to selected items</dd>
            <dt>C</dt>
            <dd>Create a content item</dd>
            <dt>D</dt>
            <dd>Duplicate selected items</dd>
            <dt>E</dt>
            <dd>Archive selected items</dd>
            <dt>L</dt>
            <dd>Localize selected items</dd>
            <dt>P</dt>
            <dd>Publish selected items</dd>
            <dt>U</dt>
            <dd>Unpublish or Unarchive selected items</dd>
            <dt>⏎</dt>
            <dd>Open currently selected item*</dd>
        </dl>
        <em class="caveat">* If only one item is selected</em>
        <h4>Interface</h4>
        <dl>
            <dt>F</dt>
            <dd>Show/hide Filters*</dd>
            <dt>V</dt>
            <dd>Toggle View (list / grid)</dd>
            <dt>Ctrl + F</dt>
            <dd>Find</dd>
            <dt>→</dt>
            <dd>Next page</dd>
            <dt>←</dt>
            <dd>Previous page</dd>
        </dl>
        <em class="caveat">* Start typing with the filters open to immediately start picking content-type filters</em>
        <h4>Selection</h4>
        <dl>
            <dt>Ctrl + A</dt>
            <dd>Select all items</dd>
            <dt>Esc</dt>
            <dd>Close modal or<br />Deselect all items</dd>
        </dl>
    </div>
    <div>
        <h3>Editor Page</h3>
        <h4>Actions</h4>
        <dl>
            <dt>F2</dt>
            <dd>Rename item</dd>
            <dt>A</dt>
            <dd>Assign a user</dd>
            <dt>D</dt>
            <dd>Set delivery key</dd>
            <dt>E</dt>
            <dd>Archive item</dd>
            <dt>L</dt>
            <dd>Localize item</dd>
            <dt>P</dt>
            <dd>Publish item</dd>
            <dt>U</dt>
            <dd>Unpublish or Unarchive item</dd>
            <dt>Ctrl + S</dt>
            <dd>Save</dd>
            <dt>Ctrl + Shift+S</dt>
            <dd>Save as...</dd>
            <dt>Esc</dt>
            <dd>Cancel editing</dd>
        </dl>
        <h4>Interface</h4>
        <dl>
            <dt>H</dt>
            <dd>Show/hide History panel</dd>
            <dt>I</dt>
            <dd>Show/hide Info (props) panel</dd>
            <dt>S</dt>
            <dd>Show/hide Scheduling panel</dd>
            <dt>V</dt>
            <dd>Show/hide Visualization panel</dd>
        </dl>
    </div>
</div>
<p class="closeHelpText">Click anywhere or press any key to close this overlay.</p>
    `

  // Add event listener to remove overlay on click or key press
  removeHelpOverlay = () => {
    const existingOverlay = document.getElementById("hotkey-help-overlay")
    if (existingOverlay) {
      existingOverlay.remove()
    }
    document.removeEventListener("click", removeHelpOverlay)
    document.removeEventListener("keydown", removeHelpOverlay)
    removeHelpOverlay = null
  }
  document.addEventListener("click", removeHelpOverlay)
  document.addEventListener("keydown", removeHelpOverlay)

  // Append overlay to body
  document.body.appendChild(overlay)
}

const removeClickCatcher = () => {
  const clickCatchers = document.querySelectorAll(
    ".md-click-catcher, .md-scroll-mask",
  )
  if (clickCatchers) {
    clickCatchers.forEach((catcher) => catcher.remove())
  }
}

function applyHotkeysSetting(enabled) {
  if (enabled) {
    startHotkeys()
    return
  }

  stopHotkeys()
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  hotkeysEnabled = Boolean(settings.hotkeysEnabled)
  applyHotkeysSetting(hotkeysEnabled)
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.hotkeysEnabled) {
    return
  }

  hotkeysEnabled = Boolean(changes.hotkeysEnabled.newValue)
  applyHotkeysSetting(hotkeysEnabled)
})
