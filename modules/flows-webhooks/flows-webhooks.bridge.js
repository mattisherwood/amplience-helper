// Flows Webhooks - page-world bridge (new UI only)
//
// The one part of this module that runs in the page's own JavaScript world
// ("world": "MAIN" in manifest.json) rather than the extension's isolated
// one. It has a single job: tell the new UI to refetch its webhook list.
//
// Why it's needed (verified 2026-11-04): the flow editor's Webhook Trigger
// dropdown is fed by an RTK Query endpoint, getWebhookListeners, on the
// app's `graphQLApi` slice. That API is created without refetchOnFocus or
// polling, and nothing invalidates it when hooks change elsewhere, so the
// dropdown keeps whatever list was fetched at page load - including after a
// hook is created or renamed on our Webhooks tab. The endpoint provides the
// `WebhookListeners` tag, so invalidating that tag makes RTK Query refetch
// every mounted query that uses it, and the dropdown re-renders with the
// fresh list. A refetch doesn't touch the flow's own state: the selected
// hook stays selected and the flow isn't marked as changed.
//
// The isolated content script can't reach the app's Redux store, so it asks
// for a refresh with a DOM event (DOM events cross worlds; JS objects don't)
// and this script does the dispatch. The event carries no data and the
// script returns none, so a page script firing the same event can do no more
// than cause a harmless refetch.
//
// If the store can't be found or the slice is renamed, nothing happens and
// the dropdown behaves as Amplience ships it (fresh on page load).

;(function () {
  "use strict"

  const EVENT = "amplience-helper:refresh-webhook-listeners"
  const REDUCER_PATH = "graphQLApi" // the RTK Query API's reducerPath
  const TAG = "WebhookListeners" // the tag getWebhookListeners provides
  const MAX_FIBERS = 5000 // the store's Provider sits a few fibers from the root

  let store = null

  function isAppStore(candidate) {
    try {
      return (
        Boolean(candidate) &&
        typeof candidate.dispatch === "function" &&
        typeof candidate.getState === "function" &&
        REDUCER_PATH in (candidate.getState() || {})
      )
    } catch (error) {
      return false
    }
  }

  /*
   * React keeps its root fiber on the container element under a
   * `__reactContainer$<random>` key. Walk down from there to the first fiber
   * whose props hold a Redux store with our API slice - react-redux's
   * <Provider store>. Found three fibers down on 2026-11-04. The store lives
   * for the life of the page, so it's looked up once.
   */
  function findStore() {
    if (store) {
      return store
    }

    const root = document.getElementById("root")

    if (!root) {
      return null
    }

    const key = Object.keys(root).find(function (name) {
      return name.indexOf("__reactContainer$") === 0
    })

    if (!key) {
      return null
    }

    const stack = [root[key]]
    let visited = 0

    while (stack.length && visited < MAX_FIBERS) {
      const fiber = stack.pop()
      visited += 1

      if (!fiber) {
        continue
      }

      const props = fiber.memoizedProps

      if (props && isAppStore(props.store)) {
        store = props.store
        return store
      }

      if (fiber.sibling) {
        stack.push(fiber.sibling)
      }

      if (fiber.child) {
        stack.push(fiber.child)
      }
    }

    return null
  }

  document.addEventListener(EVENT, function () {
    const appStore = findStore()

    if (!appStore) {
      console.debug(
        "[Amplience Helper] flows-webhooks: app store not found, webhook list not refreshed",
      )
      return
    }

    // The same action api.util.invalidateTags([TAG]) creates.
    appStore.dispatch({
      type: REDUCER_PATH + "/invalidateTags",
      payload: [TAG],
    })
  })
})()
