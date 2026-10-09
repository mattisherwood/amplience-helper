// Flows Migration - shared core
//
// API calls, file handling and the import/export pipelines used by both the
// legacy Workforce UI (flows-migration.js, app.amplience.net/content-studio)
// and the nextgen UI (flows-migration.nextgen.js, nextgen.amplience.net).
// Nothing in here touches the page DOM beyond a hidden file input and a
// download link, so it's the same on both platforms. The UI files only decide
// where the buttons go and how to work out the hub/flow IDs from the URL.
//
// Exposed as globalThis.AmplienceFlowsMigration. Content scripts from the same
// extension share one isolated world per page, so the UI scripts listed after
// this one in manifest.json can read it.

;(function () {
  "use strict"

  if (globalThis.AmplienceFlowsMigration) {
    return
  }

  const GRAPHQL_URL = "https://api.amplience.net/graphql"

  // Extract JWT from Auth0 localStorage. Both the legacy app and nextgen use
  // the Auth0 SPA SDK, which caches tokens under "@@auth0spajs@@..." keys.
  // Prefer the api.amplience.net audience entry; fall back to any entry with
  // an access token (the legacy app only has the one).
  function extractJwtFromAuth0Storage() {
    let fallback = null

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("@@auth0spajs@@")) {
        try {
          const authData = JSON.parse(localStorage.getItem(key))
          const token = authData?.body?.access_token
          if (token) {
            if (key.includes("api.amplience.net")) {
              return token
            }
            fallback = fallback || token
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    return fallback
  }

  async function graphqlRequest(query, variables) {
    const jwt = extractJwtFromAuth0Storage()
    if (!jwt) {
      return {
        success: false,
        error: "Authentication failed. Please refresh the page.",
      }
    }

    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query, variables }),
    })

    const payload = await response.json()
    return { success: true, ok: response.ok, payload }
  }

  // Fetch flow data from GraphQL
  async function fetchFlowData(flowId) {
    try {
      const query = `
        query contentFlow($flowId: ID!) {
          contentFlow(id: $flowId) {
            label
            description
            status
            flow
          }
        }
      `

      const result = await graphqlRequest(query, { flowId })
      if (!result.success) {
        return result
      }
      const { ok, payload } = result

      if (!ok || payload?.errors?.length > 0) {
        const errorMsg = payload?.errors?.[0]?.message || "Failed to fetch flow"
        console.error("[Amplience Helper] Flow export error details:", payload)
        return {
          success: false,
          error: `Export failed: ${errorMsg}`,
        }
      }

      if (!payload?.data?.contentFlow) {
        return {
          success: false,
          error: "Flow data not found",
        }
      }

      return {
        success: true,
        data: payload.data.contentFlow,
      }
    } catch (error) {
      console.error("[Amplience Helper] Flow export error:", error)
      return {
        success: false,
        error: "Export error. Check console for details.",
      }
    }
  }

  async function fetchInstances(targetHubId) {
    try {
      const query = `
        query extensionInstances( $targetHubId: ID!) {
          cmsHub(id: $targetHubId) {
            extensionInstances {
              id
              extensionRelease {
                id
              }
            }
          }
        }
      `

      const result = await graphqlRequest(query, { targetHubId })
      if (!result.success) {
        return result
      }
      const { ok, payload } = result

      if (!ok || payload?.errors?.length > 0) {
        const errorMsg =
          payload?.errors?.[0]?.message || "Failed to fetch extensions"
        console.error("[Amplience Helper] Flow import error details:", payload)
        return {
          success: false,
          error: `Import failed: ${errorMsg}`,
        }
      }

      if (!payload?.data?.cmsHub?.extensionInstances) {
        return {
          success: false,
          error: "Import failed: extension instances not found",
        }
      }

      return {
        success: true,
        data: payload.data.cmsHub.extensionInstances,
      }
    } catch (error) {
      console.error("[Amplience Helper] Flow import error:", error)
      return {
        success: false,
        error: "Import error. Check console for details.",
      }
    }
  }

  // Nextgen URLs carry the org and hub *names* (/:orgName/flows/:hubName),
  // whereas the GraphQL API wants the hub's global ID (the same ID the legacy
  // app has in its /content-studio/<hubId>/ URLs, so exports stay compatible
  // between the two UIs). Resolved once per org/hub and cached.
  const hubIdCache = new Map()

  async function resolveCmsHubId(orgName, hubName) {
    const cacheKey = `${orgName}/${hubName}`
    if (hubIdCache.has(cacheKey)) {
      return { success: true, data: hubIdCache.get(cacheKey) }
    }

    try {
      const query = `
        query organizationHubs {
          viewer {
            organizations(first: 100) {
              edges {
                node {
                  name
                  cmsHubs {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `

      const result = await graphqlRequest(query, {})
      if (!result.success) {
        return result
      }
      const { ok, payload } = result

      if (!ok || payload?.errors?.length > 0) {
        console.error("[Amplience Helper] Hub lookup error details:", payload)
        return {
          success: false,
          error: "Could not determine hub ID.",
        }
      }

      const orgs = payload?.data?.viewer?.organizations?.edges || []
      const org = orgs.find(({ node }) => node?.name === orgName)?.node
      const hub = org?.cmsHubs?.find(({ name }) => name === hubName)

      if (!hub?.id) {
        return {
          success: false,
          error: "Could not determine hub ID.",
        }
      }

      hubIdCache.set(cacheKey, hub.id)
      return { success: true, data: hub.id }
    } catch (error) {
      console.error("[Amplience Helper] Hub lookup error:", error)
      return {
        success: false,
        error: "Could not determine hub ID.",
      }
    }
  }

  async function createContentFlow(hubId, flowData) {
    try {
      const { label, description, flow, sourceHubId } = flowData

      // If the flow was exported from a different hub, create mapping of old instance
      // IDs to new instance IDs based on extension release ID. (sourceHubId may be absent
      // on files exported before this feature was added, so if in doubt treat those as
      // requiring remapping to stay safe).

      const flowObject = JSON.parse(flow)
      let parsedFlow = flow

      const sameHub = sourceHubId && sourceHubId === hubId

      if (!sameHub) {
        // Strip hub-specific reviewers from human-review actions — unrecognised
        // user IDs cause the Workforce UI to crash when editing the step.
        if (flowObject.actions) {
          flowObject.actions = flowObject.actions.map((action) => {
            if (action.action === "human-review" && action.config?.reviewers) {
              return { ...action, config: { ...action.config, reviewers: [] } }
            }
            return action
          })
          parsedFlow = JSON.stringify(flowObject)
        }

        // Remap extension instance IDs from source hub to target hub
        if (flowObject.virtualActions) {
          const extensionActions = flowObject.virtualActions.filter(
            ({ baseAction }) => baseAction === "extension-action",
          )
          const oldInstances = extensionActions
            .map(({ data }) => data.instances)
            .flat()

          if (oldInstances.length > 0) {
            const newInstances = await fetchInstances(hubId)
            if (!newInstances.success) {
              return newInstances
            }

            let mapping = {}
            for (const oldInstance of oldInstances) {
              mapping[oldInstance.id] =
                newInstances.data.find(
                  ({ extensionRelease }) =>
                    extensionRelease.id === oldInstance.releaseId,
                )?.id || null
            }

            // Swap out old instance IDs in the flow definition with new instance IDs
            const regexString = Object.keys(mapping).join("|")
            parsedFlow = regexString
              ? parsedFlow.replace(
                  new RegExp(regexString, "g"),
                  (matched) => mapping[matched],
                )
              : parsedFlow
          }
        }
      }

      const mutation = `
        mutation createContentFlow($hubId: ID!, $label: String!, $description: String!, $flow: String!) {
          createContentFlow(
            input: {
              label: $label,
              description: $description,
              flow: $flow,
              cmsHubId: $hubId
            }
          ) {
            id
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        hubId,
        label,
        description,
        flow: parsedFlow,
      })
      if (!result.success) {
        return result
      }
      const { ok, payload } = result

      if (!ok || payload?.errors?.length > 0) {
        const errorMsg =
          payload?.errors?.[0]?.message || "Failed to import flow"
        console.error("[Amplience Helper] Flow import error details:", payload)
        return {
          success: false,
          error: `Import failed: ${errorMsg}`,
        }
      }

      if (!payload?.data?.createContentFlow?.id) {
        return {
          success: false,
          error: "Import failed: invalid response from server.",
        }
      }

      return {
        success: true,
        data: { id: payload.data.createContentFlow.id },
      }
    } catch (error) {
      console.error("[Amplience Helper] Flow import error:", error)
      return {
        success: false,
        error: "Import error. Check console for details.",
      }
    }
  }

  function pickJsonFile() {
    return new Promise((resolve) => {
      const fileInput = document.createElement("input")
      fileInput.type = "file"
      fileInput.accept = ".json,application/json"
      fileInput.style.display = "none"
      document.body.appendChild(fileInput)

      let settled = false

      const cleanup = () => {
        window.removeEventListener("focus", onWindowFocus)
        if (fileInput.parentElement) {
          fileInput.parentElement.removeChild(fileInput)
        }
      }

      const finish = (file) => {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        resolve(file || null)
      }

      const onWindowFocus = () => {
        // If the picker was cancelled, no change event may fire.
        setTimeout(() => {
          if (!settled) {
            finish(null)
          }
        }, 300)
      }

      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0]
        finish(file || null)
      })

      window.addEventListener("focus", onWindowFocus)
      fileInput.click()
    })
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("Could not read selected file."))
      reader.readAsText(file)
    })
  }

  function validateImportedFlow(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        success: false,
        error: "Invalid file format. JSON object expected.",
      }
    }

    const requiredFields = ["label", "description", "status", "flow"]
    for (const field of requiredFields) {
      if (!Object.prototype.hasOwnProperty.call(data, field)) {
        return {
          success: false,
          error: `Invalid file format. Missing required property: ${field}`,
        }
      }
    }

    if (typeof data.label !== "string" || data.label.trim() === "") {
      return {
        success: false,
        error: "Invalid file format. label must be a non-empty string.",
      }
    }

    if (typeof data.description !== "string") {
      return {
        success: false,
        error: "Invalid file format. description must be a string.",
      }
    }

    if (typeof data.status !== "string") {
      return {
        success: false,
        error: "Invalid file format. status must be a string.",
      }
    }

    if (typeof data.flow !== "string" || data.flow.trim() === "") {
      return {
        success: false,
        error: "Invalid file format. flow must be a non-empty string.",
      }
    }

    return {
      success: true,
      data,
    }
  }

  // Trigger download of JSON file
  function downloadFlowAsJson(flowId, flowData, sourceHubId) {
    const exportData = sourceHubId ? { ...flowData, sourceHubId } : flowData
    const jsonContent = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonContent], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `flow-${flowId}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /*
   * The pipelines report back through two callbacks, so each UI can present
   * them its own way:
   *   onProgress(label) - work in progress, e.g. "Importing...". Called with
   *                       null when it's over. Short enough for a button.
   *   onResult({ type, message }) - type is "success" or "error". Errors can
   *                       be long, so they don't belong in the button.
   */

  /*
   * Full export pipeline: fetch the flow, then download it.
   *   flowId   - GraphQL ID of the flow
   *   getHubId - async () => hub ID or null (stamped as sourceHubId so a
   *              same-hub re-import can skip the remapping)
   */
  async function runExport({ flowId, getHubId, onProgress, onResult }) {
    onProgress("Exporting...")

    try {
      const result = await fetchFlowData(flowId)
      if (!result.success) {
        onResult({ type: "error", message: result.error })
        return result
      }

      let sourceHubId = null
      try {
        sourceHubId = await getHubId()
      } catch (error) {
        // Export still works without it; import just treats it as cross-hub.
        console.warn("[Amplience Helper] Could not resolve source hub:", error)
      }

      downloadFlowAsJson(flowId, result.data, sourceHubId)
      onResult({ type: "success", message: "Exported", label: result.data.label })
      return { success: true }
    } finally {
      onProgress(null)
    }
  }

  /*
   * Full import pipeline: pick file, parse, validate, create.
   *   getHubId - async () => target hub ID, or null if it can't be found
   * Resolves { success, cancelled?, data? } - data.id is the new flow's ID,
   * data.label its name.
   *
   * Nothing is reported while the file picker is open (the dialog speaks for
   * itself), and cancelling it reports nothing at all.
   */
  async function runImport({ getHubId, onProgress, onResult }) {
    const selectedFile = await pickJsonFile()

    if (!selectedFile) {
      return { success: false, cancelled: true }
    }

    onProgress("Importing...")

    const fail = (message, extra = {}) => {
      onResult({ type: "error", message })
      return { success: false, ...extra }
    }

    try {
      const fileText = await readFileAsText(selectedFile)
      let parsed

      try {
        parsed = JSON.parse(fileText)
      } catch (error) {
        return fail("Invalid file format. Must be valid JSON.")
      }

      const validationResult = validateImportedFlow(parsed)
      if (!validationResult.success) {
        return fail(validationResult.error)
      }

      const hubId = await getHubId()
      if (!hubId) {
        return fail("Could not determine hub ID from URL.")
      }

      const createResult = await createContentFlow(hubId, validationResult.data)
      if (!createResult.success) {
        return fail(createResult.error)
      }

      const label = validationResult.data.label
      onResult({ type: "success", message: "Imported", label })
      return { success: true, data: { ...createResult.data, label } }
    } catch (error) {
      console.error("[Amplience Helper] Flow import error:", error)
      return fail("Import failed. Please try again.")
    } finally {
      onProgress(null)
    }
  }

  globalThis.AmplienceFlowsMigration = {
    extractJwtFromAuth0Storage,
    fetchFlowData,
    fetchInstances,
    resolveCmsHubId,
    createContentFlow,
    pickJsonFile,
    readFileAsText,
    validateImportedFlow,
    downloadFlowAsJson,
    runExport,
    runImport,
  }
})()
