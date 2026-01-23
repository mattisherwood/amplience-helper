// Ensure styles are applied even after Angular renders
;(function () {
  "use strict"

  console.log("Amplience Patches: Extension loaded")

  // Add a marker to verify the script is running
  document.documentElement.setAttribute("data-amplience-patches", "enabled")
})()
