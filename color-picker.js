;(function () {
  "use strict"

  const W = 200
  const H = 20

  function drawGradient(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true })

    // Hue spectrum left to right
    const hue = ctx.createLinearGradient(0, 0, W, 0)
    for (let i = 0; i <= 12; i++) {
      hue.addColorStop(i / 12, `hsl(${i * 30},100%,50%)`)
    }
    ctx.fillStyle = hue
    ctx.fillRect(0, 0, W, H)

    // White fade top
    const white = ctx.createLinearGradient(0, 0, 0, H)
    white.addColorStop(0, "rgba(255,255,255,1)")
    white.addColorStop(0.5, "rgba(255,255,255,0)")
    ctx.fillStyle = white
    ctx.fillRect(0, 0, W, H)

    // Black fade bottom
    const black = ctx.createLinearGradient(0, 0, 0, H)
    black.addColorStop(0.5, "rgba(0,0,0,0)")
    black.addColorStop(1, "rgba(0,0,0,1)")
    ctx.fillStyle = black
    ctx.fillRect(0, 0, W, H)
  }

  function pickColor(canvas, x, y) {
    const d = canvas
      .getContext("2d")
      .getImageData(
        Math.max(0, Math.min(x, W - 1)),
        Math.max(0, Math.min(y, H - 1)),
        1,
        1,
      ).data
    return `${d[0]}, ${d[1]}, ${d[2]}`
  }

  function init(inputEl, swatchEl) {
    let picker = null

    function open() {
      if (picker) {
        close()
        return
      }

      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      drawGradient(canvas)

      picker = document.createElement("div")
      picker.style.cssText = [
        "position:fixed",
        "z-index:99999",
        "border-radius:6px",
        "overflow:hidden",
        "box-shadow:0 4px 20px rgba(0,0,0,0.35)",
        "cursor:crosshair",
      ].join(";")
      picker.appendChild(canvas)
      document.body.appendChild(picker)

      // Position below swatch, clamped to viewport
      const sr = swatchEl.getBoundingClientRect()
      picker.style.top = `${sr.bottom + 6}px`
      picker.style.left = `${sr.left}px`
      const pr = picker.getBoundingClientRect()
      if (pr.right > window.innerWidth - 4) {
        picker.style.left = `${window.innerWidth - pr.width - 4}px`
      }

      canvas.addEventListener("mousemove", (e) => {
        const cr = canvas.getBoundingClientRect()
        const color = pickColor(
          canvas,
          Math.round(e.clientX - cr.left),
          Math.round(e.clientY - cr.top),
        )
        swatchEl.style.backgroundColor = `rgb(${color})`
      })

      canvas.addEventListener("mouseleave", () => {
        swatchEl.style.backgroundColor = `rgb(${inputEl.value})`
      })

      canvas.addEventListener("click", (e) => {
        const cr = canvas.getBoundingClientRect()
        const color = pickColor(
          canvas,
          Math.round(e.clientX - cr.left),
          Math.round(e.clientY - cr.top),
        )
        inputEl.value = color
        swatchEl.style.backgroundColor = `rgb(${color})`
        inputEl.dispatchEvent(new Event("change"))
        close()
        e.stopPropagation()
      })

      setTimeout(() => document.addEventListener("click", onOutside), 0)
    }

    function close() {
      if (!picker) return
      picker.remove()
      picker = null
      document.removeEventListener("click", onOutside)
      swatchEl.style.backgroundColor = `rgb(${inputEl.value})`
    }

    function onOutside(e) {
      if (!picker || picker.contains(e.target)) return
      close()
    }

    swatchEl.style.cursor = "pointer"
    swatchEl.addEventListener("click", (e) => {
      e.stopPropagation()
      open()
    })
  }

  window.ColorPicker = { init }
})()
