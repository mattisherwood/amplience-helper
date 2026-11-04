// Flows Webhooks - shared core
//
// Data fetching, URL masking and the webhook list panel, used by both the
// classic Workforce UI (flows-webhooks.js, app.amplience.net/content-studio)
// and the new UI (flows-webhooks.nextgen.js, nextgen.amplience.net and
// unifiedapp.amplience.net).
//
// Nothing in here knows where the panel lives or how a tab activates it. The
// host scripts only decide where the tab and panel go, when the panel is
// showing, and how to work out the hub ID from the URL - they hand that last
// part in as `getHubId`.
//
// Exposed as globalThis.AmplienceFlowsWebhooks. Content scripts from the same
// extension share one isolated world per page, so the host script listed
// after this one in manifest.json can read it. Same pattern as
// flows-migration.core.js.

;(function () {
  "use strict"

  if (globalThis.AmplienceFlowsWebhooks) {
    return
  }

  const GRAPHQL_URL = "https://api.amplience.net/graphql"
  const REVEAL_TIMEOUT = 30000 // re-mask a revealed URL after 30s

  function log() {
    const args = Array.prototype.slice.call(arguments)
    console.debug.apply(
      console,
      ["[Amplience Helper] flows-webhooks:"].concat(args),
    )
  }

  /* ------------------------------------------------------------------- data */

  /*
   * Both UIs use the Auth0 SPA SDK, which caches tokens under keys prefixed
   * @@auth0spajs@@ - and a browser can hold more than one. Verified
   * 2026-11-04: a classic-app profile had an expired
   * "openid profile email offline_access" entry sitting *before* the live
   * "openid profile email" one, and the expired token got "Missing
   * permission read on Hub ..." from the API rather than a 401. So "first
   * token found" isn't good enough. Instead:
   *   - skip entries whose expiresAt (seconds) has passed
   *   - prefer the api.amplience.net audience
   *   - then take the one that expires last
   * An entry without expiresAt is treated as live, so an SDK change that
   * drops the field degrades to the old behaviour rather than to nothing.
   *
   * Not shared with flows-migration.core.js, so a failure in one module
   * can't take the other down.
   */
  function extractJwtFromAuth0Storage() {
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

  // Resolves to `data`, or throws an Error with a message fit to show inline.
  async function graphql(query, variables) {
    const token = extractJwtFromAuth0Storage()

    if (!token) {
      throw new Error("Not signed in - reload the page and try again.")
    }

    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ query: query, variables: variables || {} }),
    })

    if (!response.ok) {
      throw new Error("Amplience API returned " + response.status + ".")
    }

    const payload = await response.json()

    if (payload.errors && payload.errors.length) {
      throw new Error(
        payload.errors[0].message || "The API rejected the query.",
      )
    }

    return payload.data || {}
  }

  const WEBHOOKS_QUERY = [
    "query getWebhooks($hubId: ID!) {",
    "  cmsHub(id: $hubId) {",
    "    webhookListeners {",
    "      edges {",
    "        node {",
    "          id",
    "          label",
    "          schema",
    "          security {",
    "            __typename",
    "            ... on WebhookListenerSecurityHMAC {",
    "              header",
    "              algorithm",
    "              encoding",
    "            }",
    "          }",
    "          url",
    "        }",
    "      }",
    "    }",
    "  }",
    "}",
  ].join("\n")

  async function fetchWebhooks(hubId) {
    const data = await graphql(WEBHOOKS_QUERY, { hubId: hubId })
    const edges =
      data.cmsHub &&
      data.cmsHub.webhookListeners &&
      data.cmsHub.webhookListeners.edges

    if (!Array.isArray(edges)) {
      throw new Error("No webhook data came back for this hub.")
    }

    return edges
      .map(function (edge) {
        return edge && edge.node
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return String(a.label || "").localeCompare(String(b.label || ""))
      })
  }

  /*
   * Writes (verified by introspection 2026-11-04):
   *
   *   createWebhookListener(input: { cmsHubId, label, schema, security })
   *   updateWebhookListener(input: { id, label?, schema?, security? })
   *   deleteWebhookListener(input: { id }): Boolean
   *
   * `security` is a one-of input: { hmac: { secret, header, algorithm,
   * encoding, digestPrefix? } } or { none: { dangerouslyAllowUnauthenticated:
   * true } }. On update every hmac field is optional, so leaving `secret` out
   * keeps the current one - which matters, because the API never returns it.
   * algorithm is SHA1 | SHA256 | SHA384 | SHA512; encoding is HEX | BASE64.
   *
   * These run as the signed-in user, with their own permissions - the same
   * calls Amplience's webhook library makes.
   */
  const CREATE_MUTATION = [
    "mutation createWebhookListener($input: CreateWebhookListenerInput!) {",
    "  createWebhookListener(input: $input) {",
    "    id",
    "    label",
    "    url",
    "  }",
    "}",
  ].join("\n")

  const UPDATE_MUTATION = [
    "mutation updateWebhookListener($input: UpdateWebhookListenerInput!) {",
    "  updateWebhookListener(input: $input) {",
    "    id",
    "    label",
    "    url",
    "  }",
    "}",
  ].join("\n")

  const DELETE_MUTATION = [
    "mutation deleteWebhookListener($input: DeleteWebhookListenerInput!) {",
    "  deleteWebhookListener(input: $input)",
    "}",
  ].join("\n")

  async function createWebhook(input) {
    const data = await graphql(CREATE_MUTATION, { input: input })
    return data.createWebhookListener
  }

  async function updateWebhook(input) {
    const data = await graphql(UPDATE_MUTATION, { input: input })
    return data.updateWebhookListener
  }

  async function deleteWebhook(id) {
    const data = await graphql(DELETE_MUTATION, { input: { id: id } })

    if (!data.deleteWebhookListener) {
      throw new Error("Amplience didn't confirm the delete.")
    }

    return true
  }

  /*
   * The new UI routes by hub *name* (/:org/flows/:hubName), but cmsHub()
   * wants the GraphQL hub ID - the same Q01TSHVi... ID the classic app has in
   * its /content-studio/<hubId>/ URL. Look it up by org + hub name. Same
   * query as flows-migration.core.js resolveCmsHubId, duplicated for the same
   * self-containment reason as the token helper above.
   */
  const HUBS_QUERY = [
    "query organizationHubs {",
    "  viewer {",
    "    organizations(first: 100) {",
    "      edges {",
    "        node {",
    "          name",
    "          cmsHubs {",
    "            id",
    "            name",
    "          }",
    "        }",
    "      }",
    "    }",
    "  }",
    "}",
  ].join("\n")

  const hubIdCache = new Map()

  async function resolveCmsHubId(orgName, hubName) {
    const cacheKey = orgName + "/" + hubName

    if (hubIdCache.has(cacheKey)) {
      return hubIdCache.get(cacheKey)
    }

    const data = await graphql(HUBS_QUERY)
    const edges =
      (data.viewer &&
        data.viewer.organizations &&
        data.viewer.organizations.edges) ||
      []

    let hubId = null

    edges.forEach(function (edge) {
      const org = edge && edge.node

      if (!hubId && org && org.name === orgName) {
        ;(org.cmsHubs || []).forEach(function (hub) {
          if (!hubId && hub && hub.name === hubName && hub.id) {
            hubId = hub.id
          }
        })
      }
    })

    if (!hubId) {
      throw new Error("Could not work out which hub this is.")
    }

    hubIdCache.set(cacheKey, hubId)
    return hubId
  }

  /* --------------------------------------------------------------- helpers  */

  // The hook URL is effectively the credential, so the list shows a masked
  // form by default: origin, first path segment, and the last four characters
  // so a row is still identifiable when someone reads it out.
  function maskUrl(url) {
    if (typeof url !== "string" || !url) {
      return "—"
    }

    const tail = url.slice(-4)

    try {
      const parsed = new URL(url)
      const firstSegment = parsed.pathname.split("/").filter(Boolean)[0]
      return (
        parsed.origin +
        (firstSegment ? "/" + firstSegment : "") +
        "/…••••" +
        tail
      )
    } catch (error) {
      return url.slice(0, 28) + "…••••" + tail
    }
  }

  // security.__typename comes back as e.g. WebhookListenerSecurityNone.
  function securityLabel(security) {
    const typename = security && security.__typename

    if (!typename) {
      return "Unknown"
    }

    const stripped = typename.replace(/^WebhookListenerSecurity/, "")

    if (!stripped) {
      return typename
    }

    return stripped.replace(/([a-z])([A-Z])/g, "$1 $2")
  }

  // schema arrives as a JSON string. Pretty-print it when it parses, show it
  // verbatim when it does not.
  function formatSchema(schema) {
    if (typeof schema !== "string" || !schema.trim()) {
      return null
    }

    try {
      const parsed = JSON.parse(schema)

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Object.keys(parsed).length === 0
      ) {
        return null
      }

      return JSON.stringify(parsed, null, 2)
    } catch (error) {
      return schema
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      // The Clipboard API needs a secure context and can be blocked by
      // permissions policy, so fall back to a throwaway textarea.
      try {
        const scratch = document.createElement("textarea")
        scratch.value = text
        scratch.setAttribute("readonly", "")
        scratch.style.position = "fixed"
        scratch.style.top = "-1000px"
        scratch.style.opacity = "0"
        document.body.appendChild(scratch)
        scratch.select()
        const copied = document.execCommand("copy")
        scratch.remove()
        return copied
      } catch (fallbackError) {
        return false
      }
    }
  }

  /* ------------------------------------------------------------------ icons */

  /*
   * The official webhook mark - three nodes joined by arcs. The arc geometry
   * is Tabler's `webhook` icon (same 24px grid as the icons Amplience puts on
   * its own tabs); the three filled circles sit at the arc centres, which is
   * what the official logo has and Tabler's outline version leaves out.
   *
   * Stroked with currentColor rather than a hardcoded colour so it stays
   * visible in dark mode. Each host picks a stroke width to match the weight
   * of the native tab icons next to it.
   */
  function tabIconSvg(options) {
    const opts = options || {}
    const size = opts.size || 16
    const strokeWidth = opts.strokeWidth || 1.5
    const className = opts.className ? ' class="' + opts.className + '"' : ""

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      size +
      '" height="' +
      size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
      strokeWidth +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' +
      className +
      ">" +
      '<path d="M4.876 13.61a4 4 0 1 0 6.124 3.39h6"></path>' +
      '<path d="M15.066 20.502a4 4 0 1 0 1.934 -7.502c-.706 0 -1.424 .179 -2 .5l-3 -5.5"></path>' +
      '<path d="M16 8a4 4 0 1 0 -8 0c0 1.506 .77 2.818 2 3.5l-3 5.5"></path>' +
      '<circle cx="12" cy="8" r="1.7" fill="currentColor" stroke="none"></circle>' +
      '<circle cx="7" cy="17" r="1.7" fill="currentColor" stroke="none"></circle>' +
      '<circle cx="17" cy="17" r="1.7" fill="currentColor" stroke="none"></circle>' +
      "</svg>"
    )
  }

  // Tabler-style glyphs, drawn on the same 24px grid as Amplience's own icons
  // and stroked with currentColor so they take the URL's colour.
  const ICON = {
    eye:
      '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path>' +
      '<path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"></path>',
    eyeOff:
      '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path>' +
      '<path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"></path>' +
      '<path d="M4 4l16 16"></path>',
    copy:
      '<path d="M8 10a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"></path>' +
      '<path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"></path>',
    check: '<path d="M5 12l5 5l10 -10"></path>',
    refresh:
      '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path>' +
      '<path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>',
    pencil:
      '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"></path>' +
      '<path d="M13.5 6.5l4 4"></path>',
    plus: '<path d="M12 5l0 14"></path><path d="M5 12l14 0"></path>',
    x: '<path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path>',
    trash:
      '<path d="M4 7l16 0"></path><path d="M10 11l0 6"></path><path d="M14 11l0 6"></path>' +
      '<path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"></path>' +
      '<path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"></path>',
    alert:
      '<path d="M12 9v4"></path><path d="M12 16v.01"></path>' +
      '<path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"></path>',
  }

  function iconSvg(name) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      ICON[name] +
      "</svg>"
    )
  }

  // Only ever writes the module's own static SVG - never API data.
  function setIcon(el, name, label) {
    el.innerHTML = iconSvg(name)
    el.title = label
    el.setAttribute("aria-label", label)
  }

  function iconButton(className, name, label) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "awh-icon " + className
    setIcon(el, name, label)
    return el
  }

  function button(className, text) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = className
    el.textContent = text
    return el
  }

  /* ------------------------------------------------------------------ panel */

  /*
   * Builds the webhook list panel and returns a small controller for it.
   *
   * The panel element is created once and kept for the life of the page. A
   * host re-attaches the same element when React re-renders the page and
   * drops it, so revealed rows, expanded schemas and the fetched list all
   * survive the round trip.
   *
   * All API data is written with textContent / createElement - never
   * innerHTML - so a webhook label or schema can't inject markup. The only
   * innerHTML writes are the module's own static SVGs.
   *
   * options:
   *   id         - element id for the panel
   *   title      - optional heading shown above the list (the new UI uses
   *                one to match its own page headers; the classic tab panel
   *                does not)
   *   getHubId() - returns (or resolves to) the GraphQL hub ID, or throws
   *                an Error whose message is shown inline
   */
  function createPanel(options) {
    const opts = options || {}

    let cache = null // { hubId, items }
    let fetchInFlight = false
    let requestedHubId = null
    let renderedHubId = null // whose list is on screen right now
    const revealTimers = new Map()

    const panel = document.createElement("div")
    panel.id = opts.id || "flows-webhooks-panel"
    panel.setAttribute("role", opts.role || "region")
    panel.setAttribute("aria-label", "Webhook URLs")

    const header = document.createElement("div")
    header.className = "awh-header"

    const heading = document.createElement("div")
    heading.className = "awh-heading"

    if (opts.title) {
      const title = document.createElement("p")
      title.className = "awh-title"
      title.textContent = opts.title
      heading.appendChild(title)
    }

    const summary = document.createElement("p")
    summary.className = "awh-summary"
    heading.appendChild(summary)

    // The classic panel has no title, so its summary sits straight in the
    // header as it always has. Only wrap when there is something to group.
    header.appendChild(opts.title ? heading : summary)

    const actions = document.createElement("div")
    actions.className = "awh-header-actions"

    const refresh = iconButton("awh-refresh", "refresh", "Refresh")
    refresh.addEventListener("click", function () {
      cache = null
      load(true)
    })
    actions.appendChild(refresh)

    /*
     * Create / edit / delete live in flows-webhooks.dialog.js, which adds
     * openEditor() to this namespace. It loads after this file and before
     * the host that builds the panel, so it's in place by now; if it's
     * missing, the panel is simply read-only, as it was before.
     */
    const editable =
      typeof globalThis.AmplienceFlowsWebhooks === "object" &&
      typeof globalThis.AmplienceFlowsWebhooks.openEditor === "function"
    let highlightId = null // row to flash after a create/update

    function openEditor(webhook) {
      Promise.resolve()
        .then(function () {
          return opts.getHubId()
        })
        .then(function (hubId) {
          globalThis.AmplienceFlowsWebhooks.openEditor({
            hubId: hubId,
            webhook: webhook || null,
            onSaved: function (action, result) {
              highlightId = action === "delete" ? null : result && result.id
              cache = null
              load(true)

              // Let the host tell the rest of the app (the new UI's flow
              // editor keeps its own copy of the list).
              if (typeof opts.onChanged === "function") {
                opts.onChanged(action, result)
              }
            },
          })
        })
        .catch(showError)
    }

    if (editable) {
      const create = document.createElement("button")
      create.type = "button"
      create.className = "awh-button awh-button-primary awh-create"
      create.innerHTML = iconSvg("plus")
      create.appendChild(document.createTextNode("Create webhook URL"))
      create.addEventListener("click", function () {
        openEditor(null)
      })
      actions.appendChild(create)
    }

    header.appendChild(actions)

    const body = document.createElement("div")
    body.className = "awh-body"

    if (editable) {
      body.setAttribute("data-editable", "true")
    }

    panel.appendChild(header)
    panel.appendChild(body)

    function setSummary(text) {
      summary.textContent = text
    }

    function setRefreshBusy(busy) {
      refresh.disabled = Boolean(busy)

      if (busy) {
        refresh.setAttribute("data-busy", "true")
      } else {
        refresh.removeAttribute("data-busy")
      }
    }

    function renderMessage(className, text, retry) {
      body.textContent = ""

      const message = document.createElement("div")
      message.className = "awh-message " + className
      message.textContent = text
      body.appendChild(message)

      if (retry) {
        const again = button("awh-btn", "Try again")
        again.addEventListener("click", function () {
          cache = null
          load(true)
        })
        message.appendChild(again)
      }
    }

    function hideRow(row) {
      const url = row.getAttribute("data-url") || ""
      const code = row.querySelector(".awh-url")
      const toggle = row.querySelector(".awh-reveal")

      row.removeAttribute("data-revealed")

      if (code) {
        code.textContent = maskUrl(url)
      }

      if (toggle) {
        setIcon(toggle, "eye", "Reveal full URL")
        toggle.setAttribute("aria-pressed", "false")
      }

      const timer = revealTimers.get(row)

      if (timer) {
        clearTimeout(timer)
        revealTimers.delete(row)
      }
    }

    function revealRow(row) {
      const url = row.getAttribute("data-url") || ""
      const code = row.querySelector(".awh-url")
      const toggle = row.querySelector(".awh-reveal")

      row.setAttribute("data-revealed", "true")

      if (code) {
        code.textContent = url
      }

      if (toggle) {
        setIcon(toggle, "eyeOff", "Hide URL")
        toggle.setAttribute("aria-pressed", "true")
      }

      // Re-mask on a timer so a revealed URL does not sit on screen through a
      // screen-share once the user has moved on.
      revealTimers.set(
        row,
        setTimeout(function () {
          hideRow(row)
        }, REVEAL_TIMEOUT),
      )
    }

    // Re-masks every revealed row. Hosts call this whenever the panel stops
    // being visible, so leaving the tab never leaves a URL on screen.
    function remask() {
      revealTimers.forEach(function (timer) {
        clearTimeout(timer)
      })
      revealTimers.clear()

      Array.prototype.forEach.call(
        body.querySelectorAll('.awh-row[data-revealed="true"]'),
        hideRow,
      )
    }

    function buildRow(webhook) {
      const url = typeof webhook.url === "string" ? webhook.url : ""
      const schema = formatSchema(webhook.schema)

      const row = document.createElement("div")
      row.className = "awh-row"
      row.setAttribute("data-url", url)
      row.setAttribute("data-id", webhook.id || "")

      const main = document.createElement("div")
      main.className = "awh-row-main"

      const expand = button("awh-expand", "")
      expand.setAttribute("aria-expanded", "false")
      expand.setAttribute(
        "aria-label",
        schema ? "Show payload schema" : "No payload schema",
      )
      expand.disabled = !schema

      const labels = document.createElement("div")
      labels.className = "awh-labels"

      const label = document.createElement("span")
      label.className = "awh-label"
      label.textContent = webhook.label || "(untitled)"
      labels.appendChild(label)

      // The URL and its two actions share one line so the icons read as part
      // of the URL rather than as a separate column.
      const urlRow = document.createElement("div")
      urlRow.className = "awh-url-row"

      const code = document.createElement("code")
      code.className = "awh-url"
      code.textContent = maskUrl(url)
      urlRow.appendChild(code)

      const inlineActions = document.createElement("span")
      inlineActions.className = "awh-inline-actions"

      const reveal = iconButton("awh-reveal", "eye", "Reveal full URL")
      reveal.setAttribute("aria-pressed", "false")
      reveal.disabled = !url
      reveal.addEventListener("click", function () {
        if (row.getAttribute("data-revealed") === "true") {
          hideRow(row)
        } else {
          revealRow(row)
        }
      })
      inlineActions.appendChild(reveal)

      const copy = iconButton("awh-copy", "copy", "Copy URL")
      copy.disabled = !url
      copy.addEventListener("click", async function () {
        const copied = await copyToClipboard(url)
        setIcon(
          copy,
          copied ? "check" : "copy",
          copied ? "Copied" : "Copy failed",
        )
        copy.setAttribute("data-state", copied ? "ok" : "error")
        setTimeout(function () {
          setIcon(copy, "copy", "Copy URL")
          copy.removeAttribute("data-state")
        }, 2000)
      })
      inlineActions.appendChild(copy)

      urlRow.appendChild(inlineActions)
      labels.appendChild(urlRow)

      main.appendChild(labels)

      const badge = document.createElement("span")
      const security = securityLabel(webhook.security)
      badge.className = "awh-badge"
      badge.setAttribute("data-security", security === "None" ? "none" : "set")
      badge.textContent = security
      badge.title = "Security: " + security
      main.appendChild(badge)

      if (editable) {
        const edit = iconButton("awh-edit", "pencil", "Edit webhook URL")
        edit.addEventListener("click", function () {
          openEditor(webhook)
        })
        main.appendChild(edit)
      }

      // Last in the row, so the expander sits at the far right and the label
      // and URL line up with the row's left edge (and the schema under it).
      main.appendChild(expand)

      row.appendChild(main)

      if (schema) {
        const schemaWrap = document.createElement("pre")
        schemaWrap.className = "awh-schema"
        schemaWrap.hidden = true

        const schemaTitle = document.createElement("h4")
        schemaTitle.textContent = "Payload Schema"
        schemaWrap.appendChild(schemaTitle)

        const schemaCode = document.createElement("code")
        schemaCode.textContent = schema
        schemaWrap.appendChild(schemaCode)

        row.appendChild(schemaWrap)

        expand.addEventListener("click", function () {
          const open = expand.getAttribute("aria-expanded") === "true"
          expand.setAttribute("aria-expanded", open ? "false" : "true")
          schemaWrap.hidden = open
        })
      }

      return row
    }

    function renderWebhooks(items) {
      remask()
      body.textContent = ""

      if (!items.length) {
        setSummary("No webhook URLs in this hub")
        renderMessage(
          "awh-empty",
          editable
            ? "This hub has no webhook URLs yet. Use Create webhook URL to add one."
            : "This hub has no webhook URLs yet. Create one from the webhook library inside any flow.",
          false,
        )
        return
      }

      setSummary(
        items.length === 1 ? "1 webhook URL" : items.length + " webhook URLs",
      )

      // Labels the badge column. Rendered here rather than in the panel
      // header so it only appears when there are actually rows beneath it.
      const columns = document.createElement("div")
      columns.className = "awh-columns"

      const securityHeading = document.createElement("span")
      securityHeading.className = "awh-column-security"
      securityHeading.textContent = "Security"
      columns.appendChild(securityHeading)

      const list = document.createElement("div")
      list.className = "awh-list"

      items.forEach(function (webhook) {
        list.appendChild(buildRow(webhook))
      })

      body.appendChild(columns)
      body.appendChild(list)

      // Point at the row that was just created or edited (or asked for via
      // highlight() before the list had loaded).
      if (highlightId) {
        flashRow(highlightId)
        highlightId = null
      }
    }

    // Briefly marks a row and scrolls it into view. False if it isn't in the
    // list on screen.
    function flashRow(id) {
      const target = body.querySelector(
        '.awh-row[data-id="' + CSS.escape(id) + '"]',
      )

      if (!target) {
        return false
      }

      target.setAttribute("data-highlight", "true")
      target.scrollIntoView({ block: "nearest" })
      setTimeout(function () {
        target.removeAttribute("data-highlight")
      }, 2400)
      return true
    }

    function showError(error) {
      log("load failed", error)
      renderedHubId = null
      setSummary("Webhook URLs")
      renderMessage(
        "awh-error",
        error && error.message ? error.message : "Could not load webhook URLs.",
        true,
      )
    }

    /*
     * Shows the hub's webhooks: from the in-memory cache when it already
     * holds this hub's list, otherwise from the API. `force` skips the cache
     * (the refresh button). A list that is already on screen for this hub is
     * left alone rather than re-rendered, so re-opening the tab doesn't
     * collapse an expanded schema.
     */
    async function load(force) {
      let hubId

      try {
        hubId = await opts.getHubId()
      } catch (error) {
        showError(error)
        return
      }

      if (!hubId) {
        showError(new Error("Could not work out which hub this is."))
        return
      }

      if (!force && cache && cache.hubId === hubId) {
        if (renderedHubId !== hubId) {
          renderWebhooks(cache.items)
          renderedHubId = hubId
        }
        return
      }

      requestedHubId = hubId

      if (fetchInFlight) {
        // The in-flight fetch checks requestedHubId when it lands, and loads
        // again if the hub changed underneath it.
        return
      }

      fetchInFlight = true
      setRefreshBusy(true)
      setSummary("Loading…")
      renderMessage("awh-loading", "Fetching webhook URLs…", false)
      renderedHubId = null

      let stale = false

      try {
        const items = await fetchWebhooks(hubId)
        cache = { hubId: hubId, items: items }
        stale = requestedHubId !== hubId

        if (!stale) {
          renderWebhooks(items)
          renderedHubId = hubId
        }
      } catch (error) {
        stale = requestedHubId !== hubId

        if (!stale) {
          showError(error)
        }
      } finally {
        fetchInFlight = false
        setRefreshBusy(false)
      }

      // The user moved to another hub while we were fetching.
      if (stale) {
        load(false)
      }
    }

    return {
      element: panel,
      load: load,
      remask: remask,
      resetCache: function () {
        cache = null
        renderedHubId = null
      },
      // Flash a webhook's row - now if the list is showing, otherwise once
      // it renders. Used by the new UI's "Open Webhooks tab" shortcut to
      // point at the hook the flow uses.
      highlight: function (id) {
        if (id && !flashRow(id)) {
          highlightId = id
        }
      },
    }
  }

  globalThis.AmplienceFlowsWebhooks = {
    log: log,
    tabIconSvg: tabIconSvg,
    iconSvg: iconSvg,
    copyToClipboard: copyToClipboard,
    resolveCmsHubId: resolveCmsHubId,
    createWebhook: createWebhook,
    updateWebhook: updateWebhook,
    deleteWebhook: deleteWebhook,
    createPanel: createPanel,
  }
})()
