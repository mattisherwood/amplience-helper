// Amplience Hotkeys - Keycast overlay (both UIs)
//
// Demo aid: when a hotkey fires, briefly shows the key(s) pressed in a pill
// at the bottom of the screen, so an audience can follow along. Off by
// default and only exposed on the options page (setting:
// `hotkeysKeycastEnabled`).
//
// Loaded before hotkeys.js / hotkeys.nextgen.js, which call
// `window.AmplienceHotkeysKeycast.show(event)` once a hotkey has actually
// acted. Content scripts from the same extension share one isolated world,
// so the global is visible to them but not to the page.
//
// Esc is the exception: it's shown on every press, from this file's own
// listener, because it's mostly handled natively by the apps (closing
// modals, dropdowns etc.) rather than by our hotkeys.
//
// Styles live in hotkeys.css, scoped to
// `html[data-amplience-hotkeys-keycast="enabled"]`.

;(function () {
  "use strict"

  const DEFAULT_SETTINGS = {
    hotkeysEnabled: true,
    hotkeysKeycastEnabled: false,
  }

  const ROOT_ATTR = "data-amplience-hotkeys-keycast"
  const OVERLAY_ID = "amplience-hotkeys-keycast"
  const VISIBLE_CLASS = "is-visible"
  const VISIBLE_MS = 2000 // How long the keys stay up (fade in/out is 0.2s in CSS)

  // Case-insensitive: navigator.userAgentData.platform reports "macOS",
  // while the older navigator.platform reports "MacIntel".
  const IS_MAC = /mac|iphone|ipad/i.test(
    navigator.userAgentData?.platform || navigator.platform || "",
  )

  // Display names for non-character keys
  const KEY_NAMES = {
    Enter: "⏎",
    Escape: "Esc",
    ArrowRight: "→",
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowDown: "↓",
    Backspace: "⌫",
    Delete: "Del",
    Tab: "Tab",
    " ": "Space",
  }

  let enabled = false
  let hotkeysEnabled = DEFAULT_SETTINGS.hotkeysEnabled
  let keycastEnabled = DEFAULT_SETTINGS.hotkeysKeycastEnabled
  let hideTimer = null

  /*
   * Turns a keydown event into the list of keycaps to show, modifiers first.
   * On a Mac, Cmd and Ctrl are shown as ⌘ / ⌃ (the hotkeys accept either).
   */
  function keysFor(event) {
    const keys = []
    if (event.metaKey) keys.push(IS_MAC ? "⌘" : "Win")
    if (event.ctrlKey) keys.push(IS_MAC ? "⌃" : "Ctrl")
    if (event.altKey) keys.push(IS_MAC ? "⌥" : "Alt")

    const key = event.key
    // Shift is only worth showing when it isn't already "spent" producing
    // the character, e.g. Ctrl + Shift + S, but not for "?" or "+".
    const isSymbol = key.length === 1 && !/[a-z0-9]/i.test(key)
    if (event.shiftKey && !isSymbol) keys.push(IS_MAC ? "⇧" : "Shift")

    keys.push(KEY_NAMES[key] || (key.length === 1 ? key.toUpperCase() : key))
    return keys
  }

  function getOverlay() {
    let overlay = document.getElementById(OVERLAY_ID)
    if (overlay) return overlay

    overlay = document.createElement("div")
    overlay.id = OVERLAY_ID
    overlay.setAttribute("aria-hidden", "true") // Visual aid only
    document.body.appendChild(overlay)
    return overlay
  }

  function show(event) {
    if (!enabled || !event || !document.body) return

    const overlay = getOverlay()
    overlay.textContent = keysFor(event).join(" ")

    // A hotkey pressed while the last one is still showing just swaps the
    // keys and restarts the clock, rather than flickering out and back in.
    if (!overlay.classList.contains(VISIBLE_CLASS)) {
      void overlay.offsetWidth // Commit the hidden state so the transition runs
      overlay.classList.add(VISIBLE_CLASS)
    }

    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      overlay.classList.remove(VISIBLE_CLASS)
    }, VISIBLE_MS)
  }

  /*
   * Shows "Esc" on every press. Registered on window in the capture phase so
   * it runs before any app handler can stop propagation. It only observes:
   * no preventDefault / stopPropagation, so Esc behaves exactly as before.
   */
  function handleEscape(event) {
    if (event.key === "Escape") show(event)
  }

  // Only active when both Hotkeys and its keycast option are on, since the
  // keycast setting is kept even while Hotkeys is switched off.
  function applySettings() {
    const value = hotkeysEnabled && keycastEnabled
    if (value === enabled) return
    enabled = value

    if (enabled) {
      document.documentElement.setAttribute(ROOT_ATTR, "enabled")
      window.addEventListener("keydown", handleEscape, true)
      return
    }

    window.removeEventListener("keydown", handleEscape, true)
    document.documentElement.removeAttribute(ROOT_ATTR)
    clearTimeout(hideTimer)
    hideTimer = null
    document.getElementById(OVERLAY_ID)?.remove()
  }

  window.AmplienceHotkeysKeycast = { show }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    hotkeysEnabled = Boolean(settings.hotkeysEnabled)
    keycastEnabled = Boolean(settings.hotkeysKeycastEnabled)
    applySettings()
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return
    if (changes.hotkeysEnabled) {
      hotkeysEnabled = Boolean(changes.hotkeysEnabled.newValue)
    }
    if (changes.hotkeysKeycastEnabled) {
      keycastEnabled = Boolean(changes.hotkeysKeycastEnabled.newValue)
    }
    applySettings()
  })
})()
