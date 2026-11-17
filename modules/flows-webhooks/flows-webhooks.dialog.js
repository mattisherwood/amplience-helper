// Flows Webhooks - create / edit / delete dialog
//
// Shared by both UIs, like flows-webhooks.core.js. Adds openEditor() and
// closeEditor() to globalThis.AmplienceFlowsWebhooks; the panel shows its
// "Create webhook listener" button and clickable rows only when openEditor exists,
// so if this file fails to load the panel quietly stays read-only.
//
// Same fields as the webhook library in Amplience's flow editor - label,
// "Enable authentication", HMAC secret / header / algorithm / encoding, and
// the payload JSON Schema - laid out to match the new UI rather than the
// classic app's nested accordions.
//
// Built on a native <dialog> opened with showModal(): it sits in the top
// layer above everything Mantine renders, traps focus, closes on Escape and
// hands focus back to whatever opened it, with no framework involved. It's
// appended to <body> rather than the panel, so a React re-render of the page
// can't take it away mid-edit.
//
// Secrets: the API never returns an HMAC secret, so editing an HMAC hook
// leaves the field blank and only sends a secret if one is typed or
// generated. Secrets are never logged and never kept after the dialog
// closes.

;(function () {
  "use strict"

  const core = globalThis.AmplienceFlowsWebhooks

  if (!core) {
    console.error("[Amplience Helper] flows-webhooks.core.js not loaded")
    return
  }

  if (core.openEditor) {
    return
  }

  const DIALOG_ID = "flows-webhooks-dialog"
  const HMAC_TYPENAME = "WebhookListenerSecurityHMAC"

  const ALGORITHMS = ["SHA1", "SHA256", "SHA384", "SHA512"]
  const ENCODINGS = ["HEX", "BASE64"]

  // Matches the defaults in Amplience's own create form.
  const DEFAULTS = {
    header: "X-Hub-Signature-256",
    algorithm: "SHA256",
    encoding: "BASE64",
    schema: '{\n  "type": "object"\n}',
  }

  let current = null // { dialog, busy }

  /* ---------------------------------------------------------------- helpers */

  // Small element builder. Text only ever goes in via textContent.
  function el(tag, attrs, children) {
    const node = document.createElement(tag)

    Object.keys(attrs || {}).forEach(function (key) {
      const value = attrs[key]

      if (value === null || value === undefined || value === false) {
        return
      }

      if (key === "className") {
        node.className = value
      } else if (key === "text") {
        node.textContent = value
      } else if (value === true) {
        node.setAttribute(key, "")
      } else {
        node.setAttribute(key, value)
      }
    })
    ;(children || []).forEach(function (child) {
      if (child) {
        node.appendChild(
          typeof child === "string" ? document.createTextNode(child) : child,
        )
      }
    })

    return node
  }

  // Our own static SVG only - never API data.
  function iconButton(className, icon, label) {
    const button = el("button", {
      type: "button",
      className: "awh-icon " + className,
      title: label,
      "aria-label": label,
    })
    button.innerHTML = core.iconSvg(icon)
    return button
  }

  function setIcon(button, icon, label) {
    button.innerHTML = core.iconSvg(icon)
    button.title = label
    button.setAttribute("aria-label", label)
  }

  let uid = 0

  function nextId(name) {
    uid += 1
    return "awh-" + name + "-" + uid
  }

  // A labelled form field: label, hint, control, inline error.
  function field(options) {
    const id = options.control.id || nextId(options.name)
    const hintId = id + "-hint"
    const errorId = id + "-error"

    options.control.id = id
    options.control.setAttribute(
      "aria-describedby",
      (options.hint ? hintId + " " : "") + errorId,
    )

    const wrap = el(
      "div",
      { className: "awh-field", "data-field": options.name },
      [
        el("label", { className: "awh-field-label", for: id }, [
          options.label,
          options.required
            ? el("span", {
                className: "awh-required",
                "aria-hidden": "true",
                text: "*",
              })
            : null,
        ]),
        options.hint
          ? el("p", {
              className: "awh-field-hint",
              id: hintId,
              text: options.hint,
            })
          : null,
        options.wrapControl || options.control,
        el("p", { className: "awh-field-error", id: errorId, role: "alert" }),
      ],
    )

    return wrap
  }

  function setFieldError(form, name, message) {
    const wrap = form.querySelector('[data-field="' + name + '"]')

    if (!wrap) {
      return
    }

    const error = wrap.querySelector(".awh-field-error")
    const control = wrap.querySelector("input, select, textarea")

    if (message) {
      wrap.setAttribute("data-invalid", "true")
      error.textContent = message
      if (control) {
        control.setAttribute("aria-invalid", "true")
      }
    } else {
      wrap.removeAttribute("data-invalid")
      error.textContent = ""
      if (control) {
        control.removeAttribute("aria-invalid")
      }
    }
  }

  function select(name, options, value) {
    return el(
      "select",
      { className: "awh-input awh-select", name: name },
      options.map(function (option) {
        return el("option", {
          value: option,
          selected: option === value,
          text: option,
        })
      }),
    )
  }

  // 32 random bytes as hex - fine for any header the sender is configured
  // with, and no characters that need escaping anywhere.
  function generateSecret() {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.prototype.map
      .call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0")
      })
      .join("")
  }

  // The schema must be a JSON object. Returns an error message, or null.
  function schemaError(text) {
    if (!text.trim()) {
      return "Enter a JSON Schema."
    }

    try {
      const parsed = JSON.parse(text)

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return 'The schema must be a JSON object, e.g. { "type": "object" }.'
      }

      return null
    } catch (error) {
      return "That isn't valid JSON: " + error.message
    }
  }

  function prettySchema(text) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch (error) {
      return text
    }
  }

  /* ----------------------------------------------------------------- dialog */

  /*
   * options:
   *   hubId    - GraphQL CMS hub ID (needed to create)
   *   webhook  - the listener to edit, as the panel fetched it, or null to
   *              create one
   *   onSaved(action, result) - "create" | "update" | "delete"
   */
  function openEditor(options) {
    closeEditor(true)

    const webhook = options.webhook || null
    const editing = Boolean(webhook)
    const security = (webhook && webhook.security) || {}
    const wasHmac = security.__typename === HMAC_TYPENAME
    const initial = {
      label: editing ? webhook.label || "" : "",
      schema: editing ? prettySchema(webhook.schema || "") : DEFAULTS.schema,
      auth: editing ? wasHmac : false,
      header: (wasHmac && security.header) || DEFAULTS.header,
      algorithm: (wasHmac && security.algorithm) || DEFAULTS.algorithm,
      encoding: (wasHmac && security.encoding) || DEFAULTS.encoding,
    }

    const titleId = nextId("title")
    const dialog = el("dialog", {
      id: DIALOG_ID,
      className: "awh-dialog",
      "aria-labelledby": titleId,
    })
    const form = el("form", { className: "awh-form", novalidate: true })

    /* header */
    const close = iconButton("awh-dialog-close", "x", "Close")
    close.addEventListener("click", function () {
      closeEditor()
    })

    /*
     * The title is the label itself: an input styled as the dialog heading,
     * which shows an edit background on hover and turns into a text box when
     * clicked or tabbed to. Wrapped as a field (data-field="label") so the
     * usual validation puts its error just under it.
     */
    const label = el("input", {
      className: "awh-dialog-title awh-title-input",
      id: titleId,
      name: "label",
      type: "text",
      autocomplete: "off",
      spellcheck: "false",
      value: initial.label,
      placeholder: "Name this webhook listener",
      "aria-label": "Label",
      title: "Click to rename",
    })
    const labelErrorId = nextId("label-error")
    label.setAttribute("aria-describedby", labelErrorId)

    // Save / Create sits in the header beside the close button (which also
    // does Cancel's job). Only enabled when there's something valid to save -
    // see syncSubmit().
    const submit = el("button", {
      type: "submit",
      className: "awh-button awh-button-primary awh-submit",
      disabled: true,
    })
    submit.innerHTML = core.iconSvg("deviceFloppy")
    submit.appendChild(
      el("span", {
        className: "awh-button-label",
        text: editing ? "Save" : "Create",
      }),
    )

    // "More actions" menu - editing only, as a new listener has no URL to
    // copy and nothing to delete yet. Built further down.
    const menu = editing ? buildMenu() : null

    form.appendChild(
      el("div", { className: "awh-dialog-header" }, [
        el(
          "div",
          { className: "awh-field awh-title-field", "data-field": "label" },
          [
            label,
            el("p", {
              className: "awh-field-error",
              id: labelErrorId,
              role: "alert",
            }),
          ],
        ),
        el("div", { className: "awh-dialog-header-actions" }, [
          submit,
          menu ? menu.element : null,
          close,
        ]),
      ]),
    )

    /* authentication switch */
    const auth = el("input", {
      className: "awh-switch",
      name: "auth",
      type: "checkbox",
      role: "switch",
      checked: initial.auth,
    })
    const authId = nextId("auth")
    auth.id = authId

    const authRow = el("div", { className: "awh-switch-row" }, [
      auth,
      el("label", { for: authId, className: "awh-switch-text" }, [
        el("span", {
          className: "awh-field-label",
          text: "Enable authentication",
        }),
        el("span", {
          className: "awh-field-hint",
          text: "Require requests to this URL to be signed with a shared secret (HMAC).",
        }),
      ]),
    ])

    const openNote = el("p", { className: "awh-note awh-note-warning" })
    openNote.innerHTML = core.iconSvg("alert")
    openNote.appendChild(
      document.createTextNode(
        "Without authentication, anyone who has the URL can trigger the flows that use it.",
      ),
    )

    /* HMAC settings */
    const secret = el("input", {
      className: "awh-input",
      name: "secret",
      type: "password",
      autocomplete: "new-password",
      spellcheck: "false",
      placeholder:
        editing && wasHmac
          ? "Leave blank to keep the current secret"
          : "Enter or generate a secret",
    })
    const toggleSecret = iconButton("awh-secret-toggle", "eye", "Show secret")
    const generate = iconButton(
      "awh-secret-generate",
      "refresh",
      "Generate a secret",
    )
    const copySecret = iconButton("awh-secret-copy", "copy", "Copy secret")

    toggleSecret.addEventListener("click", function () {
      const show = secret.type === "password"
      secret.type = show ? "text" : "password"
      setIcon(
        toggleSecret,
        show ? "eyeOff" : "eye",
        show ? "Hide secret" : "Show secret",
      )
    })

    generate.addEventListener("click", function () {
      secret.value = generateSecret()
      syncSubmit()
      secret.type = "text"
      setIcon(toggleSecret, "eyeOff", "Hide secret")
      setFieldError(form, "secret", "")
      syncSecretActions()
      secret.focus()
      secret.select()
    })

    copySecret.addEventListener("click", async function () {
      if (!secret.value) {
        return
      }
      const copied = await core.copyToClipboard(secret.value)
      setIcon(
        copySecret,
        copied ? "check" : "copy",
        copied ? "Copied" : "Copy failed",
      )
      copySecret.setAttribute("data-state", copied ? "ok" : "error")
      setTimeout(function () {
        setIcon(copySecret, "copy", "Copy secret")
        copySecret.removeAttribute("data-state")
      }, 2000)
    })

    const secretNote = el("p", {
      className: "awh-note",
      hidden: true,
      text: "Copy this secret into the system that sends the requests - Amplience won't show it again once it's saved.",
    })

    const secretControl = el("div", { className: "awh-input-group" }, [
      secret,
      el("div", { className: "awh-input-actions" }, [
        toggleSecret,
        copySecret,
        generate,
      ]),
    ])

    /*
     * Show/hide and copy only appear once there's something to show or copy,
     * as in Amplience's classic form; generate is always there. Emptying the
     * field also re-masks it, so the next thing typed isn't shown in clear.
     * data-has-value lets the input's right padding shrink to fit.
     */
    function syncSecretActions() {
      const hasValue = Boolean(secret.value)

      toggleSecret.hidden = !hasValue
      copySecret.hidden = !hasValue
      secretNote.hidden = !hasValue
      secretControl.setAttribute("data-has-value", hasValue ? "true" : "false")

      if (!hasValue && secret.type !== "password") {
        secret.type = "password"
        setIcon(toggleSecret, "eye", "Show secret")
      }
    }

    secret.addEventListener("input", syncSecretActions)
    syncSecretActions()

    const header = el("input", {
      className: "awh-input",
      name: "header",
      type: "text",
      autocomplete: "off",
      spellcheck: "false",
      value: initial.header,
    })

    const algorithm = select("algorithm", ALGORITHMS, initial.algorithm)
    const encoding = select("encoding", ENCODINGS, initial.encoding)

    const hmac = el("fieldset", { className: "awh-fieldset" }, [
      el("legend", {
        className: "awh-fieldset-legend",
        text: "HMAC authentication",
        hint: "Configure HMAC authentication to secure your webhook URL. This ensures that incoming requests are verified using a shared secret.",
      }),
      field({
        name: "secret",
        label: "Secret",
        required: !(editing && wasHmac),
        hint:
          editing && wasHmac
            ? "Amplience doesn't reveal the current secret. Enter or generate a new one to replace it."
            : "A shared secret that matches the one configured in the system sending the requests.",
        control: secret,
        wrapControl: secretControl,
      }),
      secretNote,
      field({
        name: "header",
        label: "Authentication header",
        required: true,
        // Verified 2026-11-04: with this header Amplience wants GitHub's
        // "sha256=<signature>" form; with a custom header, the bare signature.
        hint: "The HTTP header the HMAC signature is sent in. With X-Hub-Signature-256 (GitHub's convention) Amplience expects the value as sha256=<signature>; with any other header, just the signature.",
        control: header,
      }),
      el("div", { className: "awh-field-row" }, [
        field({
          name: "algorithm",
          label: "HMAC algorithm",
          control: algorithm,
        }),
        field({ name: "encoding", label: "Encoding", control: encoding }),
      ]),
    ])

    function syncAuth() {
      hmac.hidden = !auth.checked
      openNote.hidden = auth.checked
    }

    auth.addEventListener("change", syncAuth)
    syncAuth()

    /* schema */
    const schema = el("textarea", {
      className: "awh-input awh-code",
      name: "schema",
      rows: "10",
      spellcheck: "false",
      autocapitalize: "off",
      autocomplete: "off",
    })
    schema.value = initial.schema

    // Tab indents rather than leaving the field; Shift+Tab still leaves it,
    // so keyboard users aren't trapped.
    schema.addEventListener("keydown", function (event) {
      if (
        event.key === "Tab" &&
        !event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault()
        schema.setRangeText(
          "  ",
          schema.selectionStart,
          schema.selectionEnd,
          "end",
        )
        syncSubmit()
      }
    })

    schema.addEventListener("blur", function () {
      setFieldError(form, "schema", schemaError(schema.value))
    })

    const format = el("button", {
      type: "button",
      className: "awh-link-button",
      text: "Format JSON",
    })
    format.addEventListener("click", function () {
      const problem = schemaError(schema.value)
      setFieldError(form, "schema", problem)
      if (!problem) {
        schema.value = prettySchema(schema.value)
        syncSubmit()
      }
    })

    const schemaField = field({
      name: "schema",
      label: "Schema",
      required: true,
      hint: "A JSON Schema that incoming request payloads are validated against.",
      control: schema,
    })
    // Put "Format JSON" on the label's line.
    const schemaLabel = schemaField.querySelector(".awh-field-label")
    const schemaHead = el("div", { className: "awh-field-head" })
    schemaLabel.before(schemaHead)
    schemaHead.appendChild(schemaLabel)
    schemaHead.appendChild(format)

    form.appendChild(
      el("div", { className: "awh-dialog-body" }, [
        authRow,
        openNote,
        hmac,
        schemaField,
      ]),
    )

    /* footer */
    const formError = el("div", {
      className: "awh-form-error",
      role: "alert",
      hidden: true,
    })

    /* delete confirmation - shown along the bottom once Delete is picked */
    const keep = el("button", {
      type: "button",
      className: "awh-button awh-button-default",
      text: "Keep it",
    })
    const confirmDelete = el("button", {
      type: "button",
      className: "awh-button awh-button-danger",
      text: "Delete webhook listener",
    })
    const confirm = el(
      "div",
      { className: "awh-dialog-footer awh-confirm", hidden: true },
      [
        el("p", { className: "awh-confirm-text" }, [
          el("strong", { text: "Delete “" + initial.label + "”?" }),
          " Any flow it triggers will stop receiving requests, and the URL can't be restored.",
        ]),
        el("div", { className: "awh-confirm-actions" }, [keep, confirmDelete]),
      ],
    )

    keep.addEventListener("click", function () {
      confirm.hidden = true
      menu.button.focus()
    })

    form.appendChild(formError)

    if (editing) {
      form.appendChild(confirm)
    }

    /*
     * The header's "⋮" menu: Copy webhook URL, then a Danger zone with
     * Delete. A plain disclosure: the button toggles it, arrow keys move
     * between items, and Escape, Tab-ing away, a click elsewhere in the
     * dialog or picking an item closes it. Escape is stopped here so it
     * closes only the menu, not the dialog.
     */
    function buildMenu() {
      const menuId = nextId("menu")

      const button = el("button", {
        type: "button",
        className: "awh-menu-button",
        "aria-label": "More actions",
        "aria-haspopup": "menu",
        "aria-expanded": "false",
        "aria-controls": menuId,
        "data-tooltip": "More actions",
      })
      button.innerHTML = core.iconSvg("dotsVertical")

      function item(icon, text, className) {
        const node = el("button", {
          type: "button",
          role: "menuitem",
          tabindex: "-1",
          className: "awh-menu-item" + (className ? " " + className : ""),
        })
        node.innerHTML = core.iconSvg(icon)
        node.appendChild(el("span", { text: text }))
        return node
      }

      const copyUrl = item("copy", "Copy webhook URL")
      copyUrl.disabled = !webhook.url
      const del = item("trash", "Delete", "awh-menu-item-danger")

      const list = el(
        "div",
        { className: "awh-menu", role: "menu", id: menuId, hidden: true },
        [
          copyUrl,
          el("div", { className: "awh-menu-divider", role: "separator" }),
          el("div", {
            className: "awh-menu-label",
            role: "presentation",
            text: "Danger zone",
          }),
          del,
        ],
      )

      const wrap = el("div", { className: "awh-menu-wrap" }, [button, list])

      function items() {
        return Array.prototype.filter.call(
          list.querySelectorAll('[role="menuitem"]'),
          function (node) {
            return !node.disabled
          },
        )
      }

      function open() {
        list.hidden = false
        button.setAttribute("aria-expanded", "true")
        const first = items()[0]
        if (first) {
          first.focus()
        }
      }

      function shut(refocus) {
        if (list.hidden) {
          return
        }
        list.hidden = true
        button.setAttribute("aria-expanded", "false")
        if (refocus) {
          button.focus()
        }
      }

      button.addEventListener("click", function () {
        if (list.hidden) {
          open()
        } else {
          shut(false)
        }
      })

      wrap.addEventListener("keydown", function (event) {
        if (list.hidden) {
          return
        }

        if (event.key === "Escape") {
          // Without preventDefault the dialog would treat it as Cancel.
          event.preventDefault()
          event.stopPropagation()
          shut(true)
          return
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault()
          const all = items()
          const at = all.indexOf(document.activeElement)
          const step = event.key === "ArrowDown" ? 1 : -1
          const next = all[(at + step + all.length) % all.length]
          if (next) {
            next.focus()
          }
        }
      })

      wrap.addEventListener("focusout", function (event) {
        if (!wrap.contains(event.relatedTarget)) {
          shut(false)
        }
      })

      // A click anywhere else in the (modal) dialog closes it.
      dialog.addEventListener("pointerdown", function (event) {
        if (!wrap.contains(event.target)) {
          shut(false)
        }
      })

      copyUrl.addEventListener("click", async function () {
        const copied = await core.copyToClipboard(webhook.url)
        const text = copyUrl.querySelector("span")
        copyUrl.innerHTML = core.iconSvg(copied ? "check" : "copy")
        copyUrl.appendChild(text)
        text.textContent = copied ? "Copied" : "Copy failed"
        setTimeout(function () {
          shut(true)
          copyUrl.innerHTML = core.iconSvg("copy")
          copyUrl.appendChild(text)
          text.textContent = "Copy webhook URL"
        }, 900)
      })

      del.addEventListener("click", function () {
        shut(false)
        confirm.hidden = false
        keep.focus()
      })

      return { element: wrap, button: button }
    }
    dialog.appendChild(form)

    /* behaviour */

    // A field's error clears as soon as it's edited.
    form.addEventListener("input", function (event) {
      const wrap = event.target.closest("[data-field]")

      if (wrap && wrap.hasAttribute("data-invalid")) {
        setFieldError(form, wrap.getAttribute("data-field"), "")
      }
    })

    /*
     * Save / Create is enabled only when the required fields - a title and a
     * schema - are filled in and, when editing, something has changed. The
     * finer checks (valid JSON, secret, header) still run on submit, so their
     * messages appear next to the field rather than as a mystery disabled
     * button. Programmatic changes (generate secret, Format JSON) call this
     * directly, as they fire no input event.
     */
    function syncSubmit() {
      if (current && current.busy) {
        return
      }

      const filled = Boolean(label.value.trim() && schema.value.trim())
      const changed = !editing || Object.keys(updateInput()).length > 1

      submit.disabled = !(filled && changed)
    }

    form.addEventListener("input", syncSubmit)
    form.addEventListener("change", syncSubmit)

    function setBusy(busy, button, text) {
      current.busy = busy
      dialog.setAttribute("aria-busy", busy ? "true" : "false")

      Array.prototype.forEach.call(
        form.querySelectorAll("input, select, textarea, button"),
        function (control) {
          control.disabled = busy
        },
      )

      // Only the text changes, so an icon beside it stays put.
      const target =
        button && (button.querySelector(".awh-button-label") || button)

      if (target) {
        if (busy) {
          button.setAttribute("data-label", target.textContent)
          target.textContent = text
        } else if (button.hasAttribute("data-label")) {
          target.textContent = button.getAttribute("data-label")
          button.removeAttribute("data-label")
        }
      }
    }

    function showFormError(error) {
      formError.textContent =
        error && error.message
          ? error.message
          : "Something went wrong. Try again."
      formError.hidden = false
    }

    function validate() {
      const problems = {
        label: label.value.trim() ? null : "Enter a label.",
        schema: schemaError(schema.value),
        secret:
          auth.checked && !secret.value && !(editing && wasHmac)
            ? "Enter or generate a secret."
            : null,
        header:
          auth.checked && !header.value.trim() ? "Enter a header name." : null,
      }

      let first = null

      Object.keys(problems).forEach(function (name) {
        setFieldError(form, name, problems[name])
        if (problems[name] && !first) {
          first = name
        }
      })

      if (first) {
        const control = form.querySelector('[name="' + first + '"]')
        if (control) {
          control.focus()
        }
      }

      return !first
    }

    function securityInput() {
      if (!auth.checked) {
        return { none: { dangerouslyAllowUnauthenticated: true } }
      }

      const hmacInput = {
        header: header.value.trim(),
        algorithm: algorithm.value,
        encoding: encoding.value,
      }

      if (secret.value) {
        hmacInput.secret = secret.value
      }

      return { hmac: hmacInput }
    }

    // On edit, only send what changed - every update field is optional.
    function updateInput() {
      const input = { id: webhook.id }

      if (label.value.trim() !== initial.label) {
        input.label = label.value.trim()
      }

      if (schema.value !== initial.schema) {
        input.schema = schema.value
      }

      const securityChanged =
        auth.checked !== initial.auth ||
        (auth.checked &&
          (Boolean(secret.value) ||
            header.value.trim() !== initial.header ||
            algorithm.value !== initial.algorithm ||
            encoding.value !== initial.encoding))

      if (securityChanged) {
        input.security = securityInput()
      }

      return input
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault()

      if (current.busy) {
        return
      }

      formError.hidden = true

      if (!validate()) {
        return
      }

      let action
      let request

      if (editing) {
        const input = updateInput()

        if (Object.keys(input).length === 1) {
          closeEditor()
          return
        }

        action = "update"
        request = function () {
          return core.updateWebhook(input)
        }
      } else {
        action = "create"
        request = function () {
          return core.createWebhook({
            cmsHubId: options.hubId,
            label: label.value.trim(),
            schema: schema.value,
            security: securityInput(),
          })
        }
      }

      setBusy(true, submit, editing ? "Saving…" : "Creating…")

      try {
        const result = await request()
        closeEditor(true)
        options.onSaved(action, result)
      } catch (error) {
        core.log(action + " failed", error && error.message)
        setBusy(false, submit)
        syncSubmit()
        showFormError(error)
      }
    })

    confirmDelete.addEventListener("click", async function () {
      if (current.busy) {
        return
      }

      formError.hidden = true
      setBusy(true, confirmDelete, "Deleting…")

      try {
        await core.deleteWebhook(webhook.id)
        closeEditor(true)
        options.onSaved("delete", { id: webhook.id })
      } catch (error) {
        core.log("delete failed", error && error.message)
        setBusy(false, confirmDelete)
        syncSubmit()
        showFormError(error)
      }
    })

    // Escape fires `cancel`. Ignore it mid-request so a half-finished save
    // isn't hidden from the user.
    dialog.addEventListener("cancel", function (event) {
      event.preventDefault()
      if (!current.busy) {
        closeEditor()
      }
    })

    // Keep keystrokes inside the dialog. The Hotkeys module listens on
    // document and treats focus on a checkbox or button as "not typing", so
    // without this, pressing W on the auth switch would close a workbench
    // tab behind the dialog. Escape still works: closing is the dialog's
    // default action, which stopPropagation doesn't touch.
    dialog.addEventListener("keydown", function (event) {
      event.stopPropagation()
    })

    current = { dialog: dialog, busy: false }
    document.body.appendChild(dialog)
    dialog.showModal()

    // A new listener needs a name first, so start in the title. When editing,
    // the title only becomes a text box once clicked, so focus the dialog
    // itself rather than letting showModal() focus the title.
    if (editing) {
      dialog.tabIndex = -1
      dialog.focus()
    } else {
      label.focus()
    }
  }

  // `force` closes even mid-request (used when the module is switched off or
  // the panel leaves the page). Dropping the dialog drops any secret with it.
  function closeEditor(force) {
    if (!current || (current.busy && !force)) {
      return
    }

    const dialog = current.dialog
    current = null

    if (dialog.open) {
      dialog.close()
    }

    dialog.remove()
  }

  core.openEditor = openEditor
  core.closeEditor = function () {
    closeEditor(true)
  }
})()
