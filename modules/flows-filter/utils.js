function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Calculates a consistent colour based on the string so that the same string always has the same colour
 * @param {string} str - The input string to generate a color for
 * @param {object} [options] - Optional settings
 * @param {"light"|"dark"} [options.shade] - "light" or "dark" to specify the shade of the color (default: any shade)
 * @param {number} [options.threshold=128] - A value between 0 and 255 to specify the minimum or maximum brightness of the color
 * @returns {string} A hex color code (e.g., "#a1b2c3")
 */
function createHexColorFromString(str, options = {}) {
  const { shade, threshold = 128 } = options

  const hash = hashString(str)

  const color = `#${[0, 1, 2]
    .map((i) =>
      (
        Math.floor((hash >> (i * 8)) % (threshold || 255)) +
        (shade === "light" ? threshold : 0)
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`

  return color
}

function getUsername() {
  return new Promise((resolve) => {
    const avatar = document.querySelector("a.mantine-Avatar-root")
    if (!avatar) {
      resolve("")
      return
    }

    const rect = avatar.getBoundingClientRect()
    const mouseEventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }

    // Mantine/React handlers typically react to one of these hover events.
    avatar.dispatchEvent(new MouseEvent("mouseenter", mouseEventInit))
    avatar.dispatchEvent(new MouseEvent("mouseover", mouseEventInit))
    avatar.dispatchEvent(new MouseEvent("mousemove", mouseEventInit))

    window.setTimeout(() => {
      const tooltip = document.querySelector(
        '[role="tooltip"], .mantine-Tooltip-tooltip',
      )

      let username = ""
      if (tooltip) {
        username = tooltip.textContent ? tooltip.textContent.trim() : ""
      }

      avatar.dispatchEvent(new MouseEvent("mouseout", mouseEventInit))
      avatar.dispatchEvent(new MouseEvent("mouseleave", mouseEventInit))
      resolve(username)
    }, 150)
  })
}

// Make functions available globally for content scripts
window.hashString = hashString
window.getUsername = getUsername
