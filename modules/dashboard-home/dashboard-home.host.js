// Dashboard Home - extensions host (new UI only)
//
// Lets Dashboard-category extensions registered on the current hub run inside
// the Dashboard Home page, until the app does this natively. It plays the
// host side of the Dashboard Extensions SDK (dc-extensions-sdk), which talks
// to its host over a MessagePort using the small protocol of
// message-event-channel: { type: request | resolve | reject | emit, event, id,
// payload }. Written by hand from that library's source (v1.2.0) so the
// extension stays dependency-free.
//
// Exposed as globalThis.AmplienceDashboardHomeHost; dashboard-home.overview.js
// and dashboard-home.js, listed after this file in manifest.json, use it.
//
// What it serves to an extension:
//  - the handshake, then `context-get` (category DASHBOARD, hub, params)
//  - `dc-management-sdk-js:request`: the Content Management API calls behind
//    sdk.client (plus GET /users on the auth service, for sdk.users.list()),
//    made with the signed-in user's own token, capped by the extension's
//    registered Read / Modify permissions
// Anything else (GraphQL, ...) is rejected as unsupported.
//
// The token never goes to the extension: it only ever sees API responses.

;(function () {
  "use strict"

  if (globalThis.AmplienceDashboardHomeHost) {
    return
  }

  const IS_QA = /amplience-qa\.net$/.test(window.location.hostname)
  const API_ORIGIN = IS_QA
    ? "https://api.amplience-qa.net"
    : "https://api.amplience.net"
  const CONTENT_API = API_ORIGIN + "/v2/content"
  // Origins an extension's request URL may name (the SDK defaults to prod);
  // the path is re-pointed at this environment's API.
  const TRUSTED_API_ORIGINS = [
    "https://api.amplience.net",
    "https://api.amplience-qa.net",
  ]
  // The SDK's users.list() also reads the auth service's user list.
  const AUTH_ORIGIN = IS_QA
    ? "https://auth.amplience-qa.net"
    : "https://auth.amplience.net"
  const TRUSTED_AUTH_ORIGINS = [
    "https://auth.amplience.net",
    "https://auth.amplience-qa.net",
  ]
  // The classic app builds the content-item links the SDK's navigator makes.
  const CLASSIC_APP = IS_QA
    ? "https://app.amplience-qa.net"
    : "https://app.amplience.net"
  const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"]

  /* ------------------------------------------------------------------ token */

  // Same approach (and the same reasons) as flows-webhooks.core.js's
  // extractJwtFromAuth0Storage, duplicated so the modules stay independent:
  // skip expired entries, prefer the api.amplience.net audience, then take
  // the one that expires last. The token lives 24h and the app refreshes it
  // itself; we never touch the refresh token.
  function getAccessToken() {
    const now = Date.now() / 1000
    let best = null

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)

      if (!key || !key.startsWith("@@auth0spajs@@")) {
        continue
      }

      try {
        const entry = JSON.parse(localStorage.getItem(key))
        const token = entry && entry.body && entry.body.access_token

        if (!token) {
          continue
        }

        const expiresAt =
          typeof entry.expiresAt === "number" ? entry.expiresAt : Infinity

        if (expiresAt <= now) {
          continue
        }

        const candidate = {
          token: token,
          expiresAt: expiresAt,
          api: key.indexOf("api.amplience.net") !== -1,
        }

        if (
          !best ||
          (candidate.api && !best.api) ||
          (candidate.api === best.api && candidate.expiresAt > best.expiresAt)
        ) {
          best = candidate
        }
      } catch (error) {
        // Ignore parse errors and keep looking
      }
    }

    return best ? best.token : null
  }

  /* -------------------------------------------------------------------- API */

  // Errors are shaped like the SDK's own ({ status, data: { errors } }) so an
  // extension handles them the way it handles a real API error.
  function apiError(status, message) {
    return {
      status: status,
      data: { errors: [{ level: "ERROR", message: message }] },
    }
  }

  async function callApi(method, path, body, base) {
    const token = getAccessToken()

    if (!token) {
      throw apiError(401, "Not signed in - reload the page and try again.")
    }

    const response = await fetch((base || CONTENT_API) + path, {
      method: method,
      // Content-Type only with a body: the auth service rejects it on a GET (415).
      headers: Object.assign(
        { Authorization: "Bearer " + token },
        body === undefined ? {} : { "Content-Type": "application/json" },
      ),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let data = text

    try {
      data = text ? JSON.parse(text) : undefined
    } catch (error) {
      // Not JSON: hand the text back as is.
    }

    const result = {
      status: response.status,
      data: data,
      headers: Object.fromEntries(response.headers.entries()),
    }

    if (!response.ok) {
      throw result
    }

    return result
  }

  // Every page of a HAL list: { _embedded: { <name>: [...] }, page }.
  async function listAll(path, name) {
    const items = []

    for (let page = 0; page < 50; page++) {
      const separator = path.indexOf("?") === -1 ? "?" : "&"
      const result = await callApi(
        "GET",
        path + separator + "size=100&page=" + page,
      )
      const data = result.data || {}
      items.push.apply(items, (data._embedded && data._embedded[name]) || [])

      if (!data.page || page + 1 >= data.page.totalPages) {
        break
      }
    }

    return items
  }

  function parseJson(value, fallback) {
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value
      return parsed && typeof parsed === "object" ? parsed : fallback
    } catch (error) {
      return fallback
    }
  }

  /* ------------------------------------------------------------- dashboards */

  const dashboardCache = new Map()

  // Resolves to { hub, dashboards }; the Dashboard-category extensions that
  // are ACTIVE on the hub with that name (the hub's URL slug).
  function listDashboards(hubName) {
    if (!dashboardCache.has(hubName)) {
      const request = loadDashboards(hubName)
      // A failure shouldn't be remembered.
      request.catch(function () {
        dashboardCache.delete(hubName)
      })
      dashboardCache.set(hubName, request)
    }

    return dashboardCache.get(hubName)
  }

  async function loadDashboards(hubName) {
    const hubs = await listAll("/hubs", "hubs")
    const hub = hubs.find(function (candidate) {
      return candidate.name === hubName
    })

    if (!hub) {
      throw new Error("Could not find this hub.")
    }

    const extensions = await listAll(
      "/hubs/" + encodeURIComponent(hub.id) + "/extensions",
      "extensions",
    )

    return {
      hub: { id: hub.id, name: hub.name, label: hub.label },
      dashboards: extensions
        .filter(function (extension) {
          return extension.category === "DASHBOARD" && extension.status === "ACTIVE"
        })
        .map(function (extension) {
          // `settings` and `parameters` are JSON strings; settings may be null.
          const settings = parseJson(extension.settings, {})
          return {
            id: extension.id,
            label: extension.label || extension.name,
            url: extension.url,
            api: settings.API || {},
            sandbox: settings.SANDBOX || {},
            installationParams: parseJson(extension.parameters, {}),
          }
        }),
    }
  }

  // Same mapping as the app's own extension frames.
  function sandboxFor(dashboard) {
    const flags = dashboard.sandbox
    const tokens = ["allow-scripts"]

    if (flags.SAME_ORIGIN !== false) tokens.push("allow-same-origin")
    if (flags.MODALS) tokens.push("allow-modals")
    if (flags.POPUPS) tokens.push("allow-popups")
    if (flags.POPUP_ESCAPE_SANDBOX) tokens.push("allow-popups-to-escape-sandbox")
    if (flags.DOWNLOADS) tokens.push("allow-downloads")
    if (flags.FORMS) tokens.push("allow-forms")
    if (flags.NAVIGATION) tokens.push("allow-top-navigation")

    return tokens.join(" ")
  }

  /* ---------------------------------------------------------- host protocol */

  // `dc-management-sdk-js:request`: { url, method, headers, data }.
  async function proxyRequest(dashboard, config) {
    const method = String(config.method || "GET").toUpperCase()

    if (WRITE_METHODS.indexOf(method) !== -1) {
      if (!dashboard.api.EDIT) {
        throw apiError(403, "This extension does not have Modify permissions")
      }
    } else if (!dashboard.api.READ) {
      throw apiError(403, "This extension does not have Read permissions")
    }

    let target

    try {
      target = new URL(config.url)
    } catch (error) {
      throw apiError(403, "Invalid request URL")
    }

    // users.list(): GET <auth>/users only (needs Read, already checked above).
    if (TRUSTED_AUTH_ORIGINS.indexOf(target.origin) !== -1) {
      if (method !== "GET" || !/^\/users\/?$/.test(target.pathname)) {
        throw apiError(403, "Only the user list can be read from this service")
      }

      return callApi("GET", target.pathname + target.search, undefined, AUTH_ORIGIN)
    }

    if (TRUSTED_API_ORIGINS.indexOf(target.origin) === -1) {
      throw apiError(403, "Refusing to send credentials to an untrusted origin")
    }

    // Keep the "/v2/content" the SDK's URLs already carry.
    const path = target.pathname.replace(/^\/v2\/content/, "") + target.search

    return callApi(
      method,
      path,
      WRITE_METHODS.indexOf(method) !== -1 ? config.data : undefined,
    )
  }

  // Wires `frame` up to `dashboard`: sets its src (with the id the SDK echoes
  // back to start the connection) and answers the SDK's requests. Returns a
  // function that disconnects.
  function connect(frame, dashboard, hub) {
    const id = crypto.randomUUID()
    const url = new URL(dashboard.url)
    url.searchParams.set("mc-name", id)

    // Without allow-same-origin the frame's origin is opaque, so messages
    // arrive from "null" and can only be posted back to "*".
    const opaque = dashboard.sandbox.SAME_ORIGIN === false
    const expectedOrigin = opaque ? "null" : url.origin
    const context = {
      category: "DASHBOARD",
      hubId: hub.id,
      hub: hub,
      // Content-item links the SDK builds point at the classic app.
      locationHref: CLASSIC_APP + "/#!/" + hub.name + "/dashboard",
      params: { installation: dashboard.installationParams, instance: {} },
    }
    let port = null

    function reply(message, type, payload) {
      port.postMessage({
        type: type,
        event: message.event,
        id: message.id,
        payload: payload,
      })
    }

    function onPortMessage(event) {
      const message = event.data

      if (!message) {
        return
      }

      if (message.type === "emit" && message.event === "mc-disconnected") {
        disconnect()
        return
      }

      if (message.type !== "request") {
        return
      }

      switch (message.event) {
        case "mc-handshake":
          reply(message, "resolve", message.payload)
          port.postMessage({ type: "emit", event: "mc-connected" })
          break
        case "context-get":
          reply(message, "resolve", context)
          break
        case "dc-management-sdk-js:request":
          proxyRequest(dashboard, message.payload || {}).then(
            function (result) {
              reply(message, "resolve", result)
            },
            function (error) {
              reply(
                message,
                "reject",
                error && error.status
                  ? { status: error.status, data: error.data }
                  : apiError(500, (error && error.message) || "Request failed"),
              )
            },
          )
          break
        default:
          reply(message, "reject", apiError(501, "Not supported here"))
      }
    }

    function onWindowMessage(event) {
      if (
        event.source !== frame.contentWindow ||
        event.origin !== expectedOrigin ||
        event.data !== id
      ) {
        return
      }

      window.removeEventListener("message", onWindowMessage)
      const channel = new MessageChannel()
      port = channel.port1
      port.onmessage = onPortMessage
      frame.contentWindow.postMessage(null, opaque ? "*" : url.origin, [
        channel.port2,
      ])
    }

    function disconnect() {
      window.removeEventListener("message", onWindowMessage)

      if (port) {
        port.close()
        port = null
      }
    }

    window.addEventListener("message", onWindowMessage)
    frame.src = url.toString()
    return disconnect
  }

  // GET /users on the auth service, for built-in dashboards (not extensions).
  async function listUsers() {
    const result = await callApi("GET", "/users", undefined, AUTH_ORIGIN)
    return (result.data && result.data.data) || []
  }

  globalThis.AmplienceDashboardHomeHost = {
    api: callApi,
    listAll: listAll,
    listUsers: listUsers,
    listDashboards: listDashboards,
    sandboxFor: sandboxFor,
    connect: connect,
  }
})()
