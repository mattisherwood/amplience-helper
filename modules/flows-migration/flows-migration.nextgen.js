// Flows Migration - Nextgen UI (nextgen.amplience.net)
//
// Separate from flows-migration.js on purpose (same reasoning as
// hotkeys.nextgen.js): that file targets the legacy Workforce app's DOM and
// /content-studio/<hubId>/content-flows routes, whereas nextgen is a
// React/Mantine app with /:orgName/flows/:hubName routes. All the API, file
// and validation logic is shared via flows-migration.core.js, so this file
// only deals with routes, hub lookup and button placement. Once the legacy app
// is retired, flows-migration.js can be deleted without touching this file.
//
// Adds:
//   - "Import Flow" on the flows listing, just left of "Create new flow"
//   - "Export Flow" in the flow editor header, just right of Run / Save
//   - Toasts (styled like nextgen's own) for success and error messages
//
// Export files are interchangeable with the legacy UI's: same shape, same
// filename, and sourceHubId is the same GraphQL hub ID in both.

;(function () {
  "use strict"

  const core = globalThis.AmplienceFlowsMigration
  if (!core) {
    console.error("[Amplience Helper] flows-migration.core.js not loaded")
    return
  }

  const DEFAULT_SETTINGS = {
    flowsMigrationEnabled: true,
  }

  const ROOT_ATTRIBUTE = "data-amplience-flows-migration"
  const SYNC_DEBOUNCE = 150

  /*
   * The page header's action buttons ("Create new flow" on the listing, "Run"
   * and "Save" in the editor) live in an actions bar. Our buttons are placed
   * as siblings of it rather than inside it, because the bar measures its own
   * children to collapse overflowing actions into a menu, and a foreign
   * button inside would upset that. If the testid goes away, the buttons
   * simply don't appear and the page behaves as normal.
   */
  const ACTIONS_BAR_SELECTOR = '[data-testid="actions-bar"]'

  /*
   * Sanity checks that we've found the right actions bar, not some other one
   * (e.g. a side panel's): the listing's has the "+" create button, the
   * editor's has the floppy-disk save button. Tabler icon classes are stable
   * across nextgen builds, unlike the hashed CSS-module classes.
   */
  const LISTING_MARKER = "button .tabler-icon-plus"
  const EDITOR_MARKER = "button .tabler-icon-device-floppy"

  let enabled = false
  let hooksInstalled = false
  let observer = null
  let syncTimeout = null

  // Built once and re-attached when React re-renders the header, so an
  // in-progress import/export keeps its disabled state and progress label.
  let exportTool = null
  let importTool = null

  /* ------------------------------------------------------------ routes ---- */

  /*
   * Nextgen flows routes:
   *   /:org/flows/:hub              -> listing
   *   /:org/flows/:hub/:flowId      -> editor
   *   /:org/flows/:hub/runs[/...]   -> (ignored)
   *   /:org/flows/:hub/settings/... -> (ignored)
   */
  function getRoute() {
    const segments = window.location.pathname.split("/").filter(Boolean)
    const [orgName, area, hubName, section, extra] = segments.map((s) => {
      try {
        return decodeURIComponent(s)
      } catch (e) {
        return s
      }
    })

    if (area !== "flows" || !orgName || !hubName) {
      return { page: null }
    }

    if (!section) {
      return { page: "listing", orgName, hubName }
    }

    if (section === "runs" || section === "settings" || extra) {
      return { page: null }
    }

    return { page: "editor", orgName, hubName, flowId: section }
  }

  async function getHubIdForRoute(route) {
    const result = await core.resolveCmsHubId(route.orgName, route.hubName)
    if (!result.success) {
      console.error("[Amplience Helper]", result.error, route)
      return null
    }
    return result.data
  }

  /* ----------------------------------------------------------- buttons ---- */

  // Tabler "download" / "upload" icons, to match the rest of the nextgen UI.
  const ICONS = {
    export:
      '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" />',
    import:
      '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" />',
  }

  // Progress shows in the button itself ("Importing..."); results go to a
  // toast (see below), so there's no status line under the button.
  function createTool(kind, label, onClick) {
    const wrapper = document.createElement("div")
    wrapper.className = "ah-flows-migration-tool"
    wrapper.dataset.kind = kind

    const button = document.createElement("button")
    button.id = `flows-migration-${kind}-btn`
    button.type = "button"
    button.className = "ah-flows-migration-btn"
    button.setAttribute("aria-label", label)
    button.setAttribute("title", label)
    button.innerHTML = `
      <svg
        class="ah-flows-migration-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >${ICONS[kind]}</svg>
      <span class="ah-flows-migration-label">${label}</span>
    `

    const labelEl = button.querySelector(".ah-flows-migration-label")
    const onProgress = (progressLabel) => {
      // Hold the width while busy so the header doesn't jiggle when the
      // label changes ("Import Flow" -> "Importing...").
      button.style.minWidth = progressLabel ? `${button.offsetWidth}px` : ""
      labelEl.textContent = progressLabel || label
      button.setAttribute("aria-label", progressLabel || label)
      button.toggleAttribute("data-busy", Boolean(progressLabel))
    }

    button.addEventListener("click", async () => {
      if (button.disabled) return
      button.disabled = true
      try {
        await onClick(onProgress)
      } finally {
        onProgress(null)
        button.disabled = false
      }
    })

    wrapper.appendChild(button)
    return wrapper
  }

  function getExportTool() {
    if (!exportTool) {
      exportTool = createTool("export", "Export Flow", async (onProgress) => {
        // Read the route at click time, in case the tool was re-attached
        // after an SPA navigation to a different flow.
        const route = getRoute()
        if (route.page !== "editor") return
        await core.runExport({
          flowId: route.flowId,
          getHubId: () => getHubIdForRoute(route),
          onProgress,
          onResult: ({ type, message, label }) =>
            type === "error"
              ? showToast("error", "Export failed", message)
              : showToast("success", "Flow exported", label),
        })
      })
    }
    return exportTool
  }

  function getImportTool() {
    if (!importTool) {
      importTool = createTool("import", "Import Flow", async (onProgress) => {
        const route = getRoute()
        if (route.page !== "listing") return
        const result = await core.runImport({
          getHubId: () => getHubIdForRoute(route),
          onProgress,
          onResult: ({ type, message }) => {
            if (type === "error") showToast("error", "Import failed", message)
          },
        })
        if (result.success) {
          // Same as legacy: reload so the new flow shows in the listing. The
          // success toast is shown after the reload (see showPendingToast).
          setPendingToast("success", "Flow imported", result.data.label)
          window.location.reload()
        }
      })
    }
    return importTool
  }

  /* ------------------------------------------------------------ toasts ---- */

  /*
   * Nextgen shows Mantine notifications (e.g. "Flow information copied"), but
   * its notifications store lives inside the app's React bundle and isn't
   * reachable from a content script (Mantine v7+ dropped the old
   * window-event API too; tested). So these are our own toasts, built to
   * look like nextgen's: same position, card, icons and type sizes. They sit
   * in our own fixed container rather than Mantine's, so React never trips
   * over a node it didn't render.
   *
   * Success toasts close after 4 s (Mantine's default); errors stay until
   * closed, since they may need reading or copying.
   */
  const TOAST_ICONS = {
    // Tabler "circle-check-filled" / "alert-circle-filled"
    success:
      '<path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" />',
    error:
      '<path d="M12 2c5.523 0 10 4.477 10 10a10 10 0 0 1 -19.995 .324l-.005 -.324l.004 -.28c.148 -5.393 4.566 -9.72 9.996 -9.72zm.01 13l-.127 .007a1 1 0 0 0 0 1.986l.117 .007l.127 -.007a1 1 0 0 0 0 -1.986l-.117 -.007zm-.01 -8a1 1 0 0 0 -.993 .883l-.007 .117v4l.007 .117a1 1 0 0 0 1.986 0l.007 -.117v-4l-.007 -.117a1 1 0 0 0 -.993 -.883z" />',
  }
  const TOAST_AUTO_CLOSE = 4000
  const PENDING_TOAST_KEY = "amplienceHelper.flowsMigration.pendingToast"

  function getToastContainer() {
    let container = document.getElementById("ah-flows-migration-toasts")
    if (!container) {
      container = document.createElement("div")
      container.id = "ah-flows-migration-toasts"
      container.className = "ah-flows-migration-toasts"
      document.body.appendChild(container)
    }
    return container
  }

  function showToast(type, title, message) {
    // Errors from the core are often "Import failed: <reason>"; the toast
    // title already says that, so don't repeat it.
    const description = String(message || "").replace(
      /^(Import|Export) failed:\s*/i,
      "",
    )

    const toast = document.createElement("div")
    toast.className = "ah-flows-migration-toast"
    toast.dataset.type = type
    toast.setAttribute("role", type === "error" ? "alert" : "status")

    const icon = document.createElement("div")
    icon.className = "ah-flows-migration-toast-icon"
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${TOAST_ICONS[type]}</svg>`

    const body = document.createElement("div")
    body.className = "ah-flows-migration-toast-body"
    const titleEl = document.createElement("div")
    titleEl.className = "ah-flows-migration-toast-title"
    titleEl.textContent = title
    body.appendChild(titleEl)
    if (description) {
      const descEl = document.createElement("div")
      descEl.className = "ah-flows-migration-toast-description"
      descEl.textContent = description
      body.appendChild(descEl)
    }

    const close = document.createElement("button")
    close.type = "button"
    close.className = "ah-flows-migration-toast-close"
    close.setAttribute("aria-label", "Close")
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>'

    let timer = null
    const dismiss = () => {
      clearTimeout(timer)
      toast.dataset.leaving = "true"
      setTimeout(() => toast.remove(), 200)
    }
    close.addEventListener("click", dismiss)

    if (type !== "error") {
      timer = setTimeout(dismiss, TOAST_AUTO_CLOSE)
      // Like Mantine: hovering pauses the auto-close.
      toast.addEventListener("mouseenter", () => clearTimeout(timer))
      toast.addEventListener("mouseleave", () => {
        timer = setTimeout(dismiss, TOAST_AUTO_CLOSE)
      })
    }

    toast.append(icon, body, close)
    getToastContainer().appendChild(toast)
  }

  // A toast to show after the page reloads (import success). sessionStorage
  // is per-tab, so it can't pop up in a different tab.
  function setPendingToast(type, title, message) {
    try {
      sessionStorage.setItem(
        PENDING_TOAST_KEY,
        JSON.stringify({ type, title, message }),
      )
    } catch (e) {
      // Not essential; the new flow still appears in the listing.
    }
  }

  function showPendingToast() {
    try {
      const pending = sessionStorage.getItem(PENDING_TOAST_KEY)
      if (!pending) return
      sessionStorage.removeItem(PENDING_TOAST_KEY)
      const { type, title, message } = JSON.parse(pending)
      showToast(type, title, message)
    } catch (e) {
      // Ignore
    }
  }

  function findActionsBar(marker) {
    return [...document.querySelectorAll(ACTIONS_BAR_SELECTOR)].find(
      (bar) => bar.getClientRects().length > 0 && bar.querySelector(marker),
    )
  }

  function detach(tool) {
    if (tool && tool.isConnected) {
      tool.remove()
    }
  }

  /* -------------------------------------------------------------- sync ---- */

  // Idempotent: puts each button where the current route wants it (or
  // removes it). Cheap enough to run on every debounced mutation batch.
  function sync() {
    syncTimeout = null

    const route = enabled ? getRoute() : { page: null }

    if (route.page === "editor") {
      const bar = findActionsBar(EDITOR_MARKER)
      const tool = getExportTool()
      if (bar && bar.nextElementSibling !== tool) {
        bar.after(tool)
      }
    } else {
      detach(exportTool)
    }

    if (route.page === "listing") {
      const bar = findActionsBar(LISTING_MARKER)
      const tool = getImportTool()
      if (bar && bar.previousElementSibling !== tool) {
        bar.before(tool)
      }
    } else {
      detach(importTool)
    }
  }

  function scheduleSync() {
    if (syncTimeout) return
    syncTimeout = setTimeout(sync, SYNC_DEBOUNCE)
  }

  // Patched once and left in place; the wrappers check `enabled` so they're
  // inert while the module is off.
  function installNavigationHooks() {
    if (hooksInstalled) return
    hooksInstalled = true

    for (const method of ["pushState", "replaceState"]) {
      const original = history[method]
      history[method] = function (...args) {
        const result = original.apply(this, args)
        if (enabled) scheduleSync()
        return result
      }
    }

    window.addEventListener("popstate", () => {
      if (enabled) scheduleSync()
    })
  }

  /* --------------------------------------------------------- lifecycle ---- */

  function start() {
    if (enabled) return
    enabled = true
    document.documentElement.setAttribute(ROOT_ATTRIBUTE, "enabled")
    installNavigationHooks()

    // Catches the header rendering late (hydration, lazy route chunks) and
    // React re-rendering it without our buttons.
    observer = new MutationObserver(scheduleSync)
    observer.observe(document.body, { childList: true, subtree: true })

    sync()
    showPendingToast()
  }

  function stop() {
    if (!enabled) return
    enabled = false
    document.documentElement.removeAttribute(ROOT_ATTRIBUTE)

    if (observer) {
      observer.disconnect()
      observer = null
    }
    clearTimeout(syncTimeout)
    syncTimeout = null

    detach(exportTool)
    detach(importTool)
    document.getElementById("ah-flows-migration-toasts")?.remove()
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (settings.flowsMigrationEnabled) {
      start()
    }
  })

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
