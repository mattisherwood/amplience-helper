// Dashboard Home - built-in "Content overview" dashboard (new UI only)
//
// The first tab, like the old UI's content report: six donuts counting the
// hub's active content items by content type, assignee, workflow status,
// publish status, last modified and locale. Hovering a slice names it.
//
// One facet request gives all the counts; content types, workflow states and
// users are fetched only to turn ids into names. Uses the signed-in user's
// token through AmplienceDashboardHomeHost (dashboard-home.host.js).
//
// Exposed as globalThis.AmplienceDashboardHomeOverview.render(container, hub).
// The only filter is the repository (default: all).

;(function () {
  "use strict"

  if (globalThis.AmplienceDashboardHomeOverview) {
    return
  }

  const SVG_NS = "http://www.w3.org/2000/svg"
  const NEUTRAL = "#dbe0f7" // "none of these": unassigned, no status, not localised
  const PALETTE = [
    "#c29d5e", "#e6e384", "#f4ab88", "#c6dd8c", "#1a416b", "#c39bc3",
    "#bdd6e0", "#96dfd6", "#bcc04a", "#72889a", "#3d5568", "#9a9a9a",
  ]
  const PUBLISH = {
    LATEST: { label: "Published", color: "#78bf9d" },
    EARLIER: { label: "Published (earlier version)", color: "#c6dd8c" },
    NONE: { label: "Unpublished", color: NEUTRAL },
  }
  // [facet name, DC date range end, label, colour]; counts are cumulative and
  // turned into separate slices below.
  const AGES = [
    ["d7", "-7:DAYS", "Last 7 days", "#7f5f9f"],
    ["d30", "-30:DAYS", "Last 30 days", "#c39bc3"],
    ["d90", "-90:DAYS", "Last 90 days", "#72889a"],
    ["d365", "-365:DAYS", "Last year", "#8fa0d1"],
  ]
  const OLDER = { label: "Older", color: "#c8c4d6" }
  const OUTER = 94
  const INNER = 64

  function el(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text) node.textContent = text
    return node
  }

  // ---- data ----------------------------------------------------------------

  const count = (facets, name) => facets[name] || []
  const total = (items) => items.reduce((sum, item) => sum + Number(item.count), 0)

  function tail(uri) {
    return String(uri).split("/").pop() || String(uri)
  }

  function flag(region) {
    return /^[A-Za-z]{2}$/.test(region)
      ? String.fromCodePoint(...[...region.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)))
      : ""
  }

  function localeLabel(tag) {
    const [language, region] = tag.split(/[-_]/)
    let name = language
    try {
      name = new Intl.DisplayNames(["en"], { type: "language" }).of(language) || language
    } catch (error) {
      // Unknown tag: show it as is.
    }
    return (region && flag(region) ? flag(region) + " " : "") + name
  }

  // Sorted largest first, neutral entries keep their pale colour and the rest
  // take palette colours in order.
  function colour(items) {
    items.sort((a, b) => b.count - a.count)
    let next = 0
    items.forEach((item) => {
      if (!item.color) item.color = item.neutral ? NEUTRAL : PALETTE[next++ % PALETTE.length]
    })
    return items
  }

  const hubPath = (hub) => "/hubs/" + encodeURIComponent(hub.id)

  // Names for ids (fetched once per render): content types, workflow states,
  // users and the repositories for the filter. A failed lookup just means ids
  // (or no filter) rather than no report.
  async function loadLookups(hub) {
    const host = globalThis.AmplienceDashboardHomeHost
    const [types, states, users, repositories] = await Promise.all([
      host.listAll(`${hubPath(hub)}/content-types`, "content-types").catch(() => []),
      host.listAll(`${hubPath(hub)}/workflow-states`, "workflow-states").catch(() => []),
      host.listUsers().catch(() => []),
      host.listAll(`${hubPath(hub)}/content-repositories`, "content-repositories").catch(() => []),
    ])
    const typeNames = {}
    types.forEach((type) => {
      typeNames[type.contentTypeUri] = (type.settings && type.settings.label) || tail(type.contentTypeUri)
    })
    const stateNames = {}
    states.forEach((state) => { stateNames[state.id] = state.label })
    const userNames = {}
    users.forEach((user) => {
      const a = user.attributes || {}
      userNames[user.id] = [a["first-name"], a["last-name"]].filter(Boolean).join(" ") || a.email || user.id
    })
    return { typeNames, stateNames, userNames, repositories }
  }

  // The counts for the whole hub, or for one repository when repositoryId is set.
  async function loadCharts(hub, repositoryId, lookups) {
    const host = globalThis.AmplienceDashboardHomeHost
    const { typeNames, stateNames, userNames } = lookups
    const fields = [
      { facetAs: "ENUM", field: "schema" },
      { facetAs: "ENUM", field: "assignees" },
      { facetAs: "ENUM", field: "workflow.state" },
      { facetAs: "ENUM", field: "publishingStatus" },
      { facetAs: "ENUM", field: "locale" },
    ].concat(
      AGES.map(([name, end]) => ({
        facetAs: "DATE", field: "lastModifiedDate", name, range: { start: "NOW", end },
      })),
    )
    const filter = 'status:"ACTIVE"' + (repositoryId ? ` contentRepositoryId:"${repositoryId}"` : "")
    const facetResponse = await host.api(
      "POST",
      `${hubPath(hub)}/content-items/facet?query=${encodeURIComponent(filter)}&size=1`,
      { fields, returnEntities: false },
    )
    const facets = (facetResponse.data && facetResponse.data._facets) || {}

    const schema = count(facets, "schema")
    const everything = total(schema)

    const locales = count(facets, "locale").map((item) => ({
      tag: item._id,
      label: item._id ? localeLabel(item._id) : "Not localised",
      count: Number(item.count),
      neutral: !item._id,
    }))
    // Two locales of one language (en-GB, en-US) get their tag added.
    const names = locales.map((item) => item.label)
    locales.forEach((item, index) => {
      if (item.tag && names.filter((name) => name === names[index]).length > 1) {
        item.label = `${names[index]} (${item.tag})`
      }
    })
    colour(locales)

    // Cumulative age counts -> separate slices.
    const cumulative = AGES.map(([name]) => total(count(facets, name)))
    const ages = AGES.map(([, , label, color], index) => ({
      label, color, count: cumulative[index] - (index ? cumulative[index - 1] : 0),
    }))
    ages.push({ ...OLDER, count: everything - cumulative[cumulative.length - 1] })

    return {
      total: everything,
      charts: [
        { title: "Content type", items: colour(schema.map((item) => ({
          label: typeNames[item._id] || tail(item._id), count: Number(item.count),
        }))) },
        { title: "Assigned to", items: colour(count(facets, "assignees").map((item) => ({
          label: item._id === "UNASSIGNED" ? "Unassigned" : userNames[item._id] || item._id.slice(0, 8),
          count: Number(item.count), neutral: item._id === "UNASSIGNED",
        }))) },
        { title: "Status", items: colour(count(facets, "state").map((item) => ({
          label: item._id ? stateNames[item._id] || item._id.slice(0, 8) : "No status",
          count: Number(item.count), neutral: !item._id,
        }))) },
        { title: "Publish status", items: colour(count(facets, "publishingStatus").map((item) => ({
          label: (PUBLISH[item._id] || { label: item._id }).label,
          color: (PUBLISH[item._id] || {}).color, count: Number(item.count),
        }))) },
        { title: "Last modified", items: ages.filter((item) => item.count > 0) },
        { title: "Locale", items: locales },
      ],
    }
  }

  // ---- drawing -------------------------------------------------------------

  function slicePath(start, end) {
    const at = (radius, angle) => `${100 + radius * Math.cos(angle)} ${100 + radius * Math.sin(angle)}`
    const large = end - start > Math.PI ? 1 : 0
    return `M${at(OUTER, start)}A${OUTER} ${OUTER} 0 ${large} 1 ${at(OUTER, end)}` +
      `L${at(INNER, end)}A${INNER} ${INNER} 0 ${large} 0 ${at(INNER, start)}Z`
  }

  function donut(chart) {
    const cell = el("div", "amplience-dashboard-home__chart")
    const svg = document.createElementNS(SVG_NS, "svg")
    svg.setAttribute("viewBox", "0 0 200 200")
    svg.setAttribute("role", "img")
    svg.setAttribute("aria-label", chart.title)
    const tip = el("div", "amplience-dashboard-home__tip")
    tip.hidden = true

    const sum = total(chart.items)
    if (!sum) {
      // Nothing to count (e.g. an empty repository): a plain empty ring.
      const ring = document.createElementNS(SVG_NS, "path")
      ring.setAttribute("d", slicePath(-Math.PI / 2, (3 * Math.PI) / 2 - 0.0001))
      ring.setAttribute("fill", NEUTRAL)
      svg.appendChild(ring)
    }
    let angle = -Math.PI / 2
    chart.items.forEach((item) => {
      const sweep = Math.min((item.count / sum) * 2 * Math.PI, 2 * Math.PI - 0.0001)
      const path = document.createElementNS(SVG_NS, "path")
      path.setAttribute("d", slicePath(angle, angle + sweep))
      path.setAttribute("fill", item.color)
      angle += sweep
      path.addEventListener("mouseenter", () => {
        path.classList.add("is-active")
        svg.classList.add("has-active")
        tip.textContent = `${item.label} (${item.count.toLocaleString()})`
        tip.hidden = false
      })
      path.addEventListener("mousemove", (event) => {
        const box = cell.getBoundingClientRect()
        tip.style.left = `${event.clientX - box.left + 12}px`
        tip.style.top = `${event.clientY - box.top + 12}px`
      })
      path.addEventListener("mouseleave", () => {
        path.classList.remove("is-active")
        svg.classList.remove("has-active")
        tip.hidden = true
      })
      svg.appendChild(path)
    })

    const ring = el("div", "amplience-dashboard-home__ring")
    ring.append(svg, el("div", "amplience-dashboard-home__chart-title", chart.title))
    cell.append(ring, tip)
    return cell
  }

  function errorText(error) {
    return error && error.data && error.data.errors
      ? error.data.errors[0].message
      : (error && error.message) || "Unknown error"
  }

  function repositoryFilter(repositories, onChange) {
    const wrapper = el("label", "amplience-dashboard-home__filter")
    const select = el("select", "amplience-dashboard-home__filter-select")
    select.appendChild(new Option("All", ""))
    repositories
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((repository) => select.appendChild(new Option(repository.label, repository.id)))
    select.addEventListener("change", () => onChange(select.value))
    wrapper.append("Repository", select)
    return wrapper
  }

  async function render(container, hub) {
    container.replaceChildren(el("p", "amplience-dashboard-home__message", "Loading report\u2026"))
    let lookups
    let first
    try {
      lookups = await loadLookups(hub)
      first = await loadCharts(hub, "", lookups)
    } catch (error) {
      if (container.isConnected) {
        container.replaceChildren(el("p", "amplience-dashboard-home__message", `Couldn't load the content report: ${errorText(error)}`))
      }
      return
    }
    if (!container.isConnected) return // the user moved on while it loaded

    const card = el("section", "amplience-dashboard-home__report")
    card.appendChild(el("h2", "amplience-dashboard-home__report-title", "Content report"))
    const summary = el("div", "amplience-dashboard-home__report-summary")
    const itemCount = el("span")
    const grid = el("div", "amplience-dashboard-home__charts")

    function show(data) {
      itemCount.replaceChildren(el("strong", "", data.total.toLocaleString()), " items")
      grid.replaceChildren(...data.charts.map(donut))
      grid.classList.remove("is-loading")
    }

    // Only the latest choice is shown if the user changes it again mid-load.
    let latest = 0
    async function choose(repositoryId) {
      const request = ++latest
      grid.classList.add("is-loading")
      try {
        const data = await loadCharts(hub, repositoryId, lookups)
        if (request === latest && container.isConnected) show(data)
      } catch (error) {
        if (request === latest && container.isConnected) {
          grid.classList.remove("is-loading")
          grid.replaceChildren(el("p", "amplience-dashboard-home__message", `Couldn't load the content report: ${errorText(error)}`))
        }
      }
    }

    summary.append(itemCount, repositoryFilter(lookups.repositories, choose))
    card.append(summary, grid)
    show(first)
    container.replaceChildren(el("h1", "amplience-dashboard-home__heading", "Content Operations Dashboard"), card)
  }

  globalThis.AmplienceDashboardHomeOverview = { render: render }
})()
