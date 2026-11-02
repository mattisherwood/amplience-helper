[< Back](../../README.md)

# Hotkeys Module

Adds keyboard shortcuts to Amplience CMS (formerly Dynamic Content) pages in the classic UI, and to the CMS, DAM, Reviews and Workforce flows pages in the next-gen UI. This module is part of the `amplience-helper` extension and can be toggled from popup/options.

## Features

- Keyboard shortcuts for common actions in Amplience
- Quick navigation to top-level menu items with number keys
- Built-in help overlay for discovering shortcuts (in next-gen, it lists your current page's shortcuts first, right after the global ones)
- Optional on-screen keycast of each hotkey as you use it, for demos
- Input-aware behavior to avoid accidental actions while typing

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Hotkeys**
- Extension options page: toggle **Enable Hotkeys**

The setting key is `hotkeysEnabled` in `chrome.storage.sync`.

### Show hotkeys on screen (demo mode)

Options page only, under **Enable Hotkeys** (hidden while hotkeys are off): **Show hotkeys on screen**. Off by default. When on, each hotkey that actually acts shows its keys (e.g. `⌘ A`) in a small dark tile at the bottom-centre of the screen for 2 seconds, scaling and fading in/out over 0.2s. Pressing another hotkey while it's up swaps the keys and restarts the 2 seconds.

- Setting key: `hotkeysKeycastEnabled` (default `false`)
- Logic: `hotkeys.keycast.js`, loaded before `hotkeys.js` / `hotkeys.nextgen.js` in both UIs. It exposes `window.AmplienceHotkeysKeycast.show(event)`.
- Styles: `hotkeys.css`, scoped to `html[data-amplience-hotkeys-keycast="enabled"]`
- Legacy (`hotkeys.js`): `handleKeydown` wraps `runHotkeys` and shows the keycast when the event goes from not-prevented to prevented, so **any new legacy hotkey must call `event.preventDefault()` synchronously** to appear.
- Nextgen (`hotkeys.nextgen.js`): shown when `perform()` returns true, so nothing extra is needed for new `HOTKEYS` entries.
- Esc is shown on every press, by a capture-phase `window` listener in `hotkeys.keycast.js` itself, since the apps mostly handle it natively (closing modals and dropdowns). It only observes, never preventing or stopping the event.
- The keycast only runs while both `hotkeysEnabled` and `hotkeysKeycastEnabled` are on.
- Modifiers show as ⌘ ⌃ ⌥ ⇧ on a Mac and Win / Ctrl / Alt / Shift elsewhere. Shift is left out when it only produced the character (`?`, `+`).

## Available Hotkeys

On a Mac, **Ctrl** also means **Cmd** (either works). Press `?` in either UI for the same list as an on-screen cheatsheet.

### Next-gen UI (nextgen.amplience.net / unifiedapp.amplience.net)

Generated from the `HOTKEYS` table in `hotkeys.nextgen.js`, which also drives the `?` cheatsheet and the button tooltips. When you change that table, update these tables to match.

#### Any Time

|     | Help                   |
| --- | ---------------------- |
| ?   | Show this help overlay |
| F1  | Open the documentation |

|     | Interface         |
| --- | ----------------- |
| W   | Close current tab |

|     | Navigation     |
| --- | -------------- |
| 0   | Home/Dashboard |
| 1   | Content        |
| 2   | Assets         |
| 3   | Content Types  |
| 4   | Reviews        |
| 5   | Flows          |
| 6   | Settings       |

#### While Listing Content

|       | Actions                            |
| ----- | ---------------------------------- |
| F2    | Rename selected item               |
| A     | Assign a user to selected item(s)  |
| C     | Create a new content item          |
| D     | Duplicate selected item(s)         |
| E     | Archive selected item(s)           |
| L     | Localize selected item(s)          |
| P     | Publish selected item(s)           |
| T     | Tag selected item(s)               |
| U     | Unpublish selected item(s)         |
| +     | Add selected item(s) to collection |
| Enter | Open selected item(s)              |

|          | Interface                 |
| -------- | ------------------------- |
| F        | Show/hide Filters         |
| Ctrl + F | Find                      |
| V        | Toggle View (list / grid) |
| →        | Next page                 |
| ←        | Previous page             |

|          | Selection          |
| -------- | ------------------ |
| Ctrl + A | Select all items   |
| Esc      | Deselect all items |

#### While Editing Content

|          | Actions        |
| -------- | -------------- |
| F2       | Rename item    |
| A        | Assign a user  |
| E        | Archive item   |
| L        | Localize item  |
| P        | Publish item   |
| U        | Unpublish item |
| Ctrl + S | Save           |

|     | Interface                     |
| --- | ----------------------------- |
| H   | Show/hide History panel       |
| I   | Show/hide Info (props) panel  |
| J   | Show/hide JSON preview panel  |
| V   | Show/hide Visualization panel |

#### While Managing Assets

|          | Actions                            |
| -------- | ---------------------------------- |
| P        | Publish selected item(s)           |
| Ctrl + U | Upload                             |
| +        | Add selected item(s) to collection |
| Enter    | Open selected item(s)              |

|          | Interface                 |
| -------- | ------------------------- |
| F        | Show/hide Filters         |
| Ctrl + F | Find                      |
| V        | Toggle View (list / grid) |
| →        | Next page                 |
| ←        | Previous page             |

|          | Selection          |
| -------- | ------------------ |
| Ctrl + A | Select all items   |
| Esc      | Deselect all items |

#### While Listing Content Types

|     | Actions                   |
| --- | ------------------------- |
| C   | Create a new content type |

|          | Interface         |
| -------- | ----------------- |
| F        | Show/hide Filters |
| Ctrl + F | Find              |
| →        | Next page         |
| ←        | Previous page     |

|          | Selection          |
| -------- | ------------------ |
| Ctrl + A | Select all types   |
| Esc      | Deselect all types |

#### While Editing Content Types

|          | Actions |
| -------- | ------- |
| Ctrl + S | Save    |

#### While Listing Reviews

|          | Interface         |
| -------- | ----------------- |
| F        | Show/hide Filters |
| Ctrl + F | Find              |

|          | Selection            |
| -------- | -------------------- |
| Ctrl + A | Select all reviews   |
| Esc      | Deselect all reviews |

#### While Listing Flows

|     | Actions           |
| --- | ----------------- |
| C   | Create a new flow |

|          | Interface                 |
| -------- | ------------------------- |
| Ctrl + F | Find                      |
| V        | Toggle View (list / grid) |

#### While Editing Flows

|          | Actions |
| -------- | ------- |
| Ctrl + S | Save    |

#### While Viewing a Flow Run

|     | Interface                 |
| --- | ------------------------- |
| V   | Show/hide Flow view panel |

#### While Listing Flow Runs

|          | Interface         |
| -------- | ----------------- |
| F        | Show/hide Filters |
| Ctrl + F | Find              |

### Classic UI (app.amplience.net)

#### Global

|     | Navigation (follows top-nav) |
| --- | ---------------------------- |
| 1   | Dashboard                    |
| 2   | Content                      |
| 3   | Assets                       |
| 4   | Scheduling                   |
| 5   | Content Type Schemas         |
| 6   | Content Types                |
| 7   | Extensions                   |
| 8   | Webhooks                     |
| 9   | Personal Access Tokens       |
| 0   | Integrations                 |

|     | Help                            |
| --- | ------------------------------- |
| ?   | Show overlay with all shortcuts |
| F1  | Open the docs (in a new tab)    |

#### Listing Page

|     | Actions                                  |
| --- | ---------------------------------------- |
| F2  | Rename selected item (one item selected) |
| A   | Assign a user to selected items          |
| C   | Create a content item                    |
| D   | Duplicate selected items                 |
| E   | Archive selected items                   |
| L   | Localize selected items                  |
| P   | Publish selected items                   |
| S   | Sync selected items                      |
| T   | Tag selected items with a status         |
| U   | Unarchive selected items                 |
| ⏎   | Open selected item (one item selected)   |

|          | Interface                 |
| -------- | ------------------------- |
| F        | Show/hide Filters         |
| V        | Toggle View (list / grid) |
| Ctrl + F | Find                      |
| →        | Next page                 |
| ←        | Previous page             |

|          | Selection                         |
| -------- | --------------------------------- |
| Ctrl + A | Select all items                  |
| Esc      | Close modal or Deselect all items |

#### Editor Page

|                  | Actions          |
| ---------------- | ---------------- |
| F2               | Rename item      |
| A                | Assign a user    |
| D                | Set delivery key |
| E                | Archive item     |
| L                | Localize item    |
| P                | Publish item     |
| Ctrl + S         | Save             |
| Ctrl + Shift + S | Save as...       |
| Esc              | Cancel editing   |

|     | Interface                     |
| --- | ----------------------------- |
| H   | Show/hide History panel       |
| I   | Show/hide Info (props) panel  |
| S   | Show/hide Scheduling panel    |
| V   | Show/hide Visualization panel |

#### Content Type Schemas & Content Types

|          | Listing pages |
| -------- | ------------- |
| Ctrl + F | Find          |
| →        | Next page     |
| ←        | Previous page |

|     | Schema editor              |
| --- | -------------------------- |
| Esc | Cancel editing and go back |

## Usage Tips

- Press `?` anytime to open the full shortcut overlay.
- In listings, press `F` to open filters, then type letters to quickly narrow content-type filter options.
- Hotkeys are disabled while typing in form fields (except specific keys such as Enter/Ctrl/Cmd combos where relevant).

## Development

### Project Structure

```
modules/hotkeys/
├── hotkeys.js          # Legacy app (app.amplience.net) hotkey logic
├── hotkeys.keycast.js  # "Show hotkeys on screen" overlay (both apps)
├── hotkeys.nextgen.js  # Nextgen UI (nextgen./unifiedapp.amplience.net), driven by its HOTKEYS table
├── hotkeys.css         # Help overlay, keycast + filter-typing styles (both apps)
└── README.md           # This file
```

### Adding New Hotkeys (nextgen)

1. In `hotkeys.nextgen.js`, uncomment or add an entry in `HOTKEYS` under the right page
2. Set `target` (click), `focus` (focus an input) or `run` (custom function). Prefer `data-testid` / `aria-label` / `role`, then `.mantine-*` classes, and never the hashed `_name_xxxx` classes
3. That's it: the tooltip and the `?` overlay entry are generated from the same entry

### Adding New Hotkeys (legacy)

1. Open `hotkeys.js`
2. Add a new event listener block following the existing pattern
3. Use the `isTypingInInput()` helper to respect input field focus
4. Update the help overlay so discoverability stays in sync
5. Reload extension and refresh Amplience to test

### Code Guidelines

- All hotkeys should check for input field focus (except Escape)
- Use `.querySelector()` to find DOM elements
- Prevent default browser behavior with `event.preventDefault()`
- Add descriptive comments for each hotkey action

## Privacy

- Runs only on Amplience pages configured in the parent extension manifest
- No telemetry or external tracking is implemented by this module
- All behavior executes locally in the browser content script

## License

This is a utility extension for personal/internal use. Amplience is a trademark of Amplience Ltd.

## Support

1. Use the in-app help overlay (`?`) first.
2. Confirm the module is enabled in popup/options.
3. If needed, open DevTools and check for script/runtime errors.

## Changelog

### v1.5

- Add **F2** to rename items (on listing page when one item is selected, and in editor)
- Add **Enter** to open currently selected item (on listing page when one item is selected)
- Add **F1** to open Amplience documentation in a new tab
- **F** filter enhancement: After opening filters with **F**, type letters to quickly filter by content type (e.g., type "pa" to filter to "page" content types)
- Add **Ctrl/Cmd + F** search support in the create content modal
- Improve **Escape** and **Enter** key handling in filters panel and create content modal
- Add keyboard navigation support for schema listing pages

### v1.4

- Add tooltip titles to buttons noting the relevant shortcut for saving time on repeat clicks.

### v1.3

- Drop **A** for navigating to archive
- Make **A** consistently "Assign user"\
  _(NB: There is still a known bug with the core assign-user button)_
- Add **D** for Duplicate
- Add **L** for Localize
- Standardise to match across listing and editor pages where possible
- Group hotkeys into Global / Listing Page / Editor Page contexts
- Update help files to reflect that

### v1.2.1

- Allow Ctrl+numbers to still do their usual jobs\
  (e.g. Ctrl+0 resets the zoom)

### v1.2

- Add **C** to create a new content item
- Update/limit hotkeys when createContent modal is open
- Add **S _or_ Ctrl / Cmd + S** to save content item

### v1.1

- Add **A** to navigate to archive
- Add **P** to publish selected items
- Add **U** to
  - unarchive selected items _(if in archive)_
  - assign User to selected items _(if not in archive)_
- Categorise hotkeys in the help files

### v1.0

- Initial release
- Selection/Deselection Hotkeys
  - **Ctrl / Cmd + A** to select all
  - **Esc** to deselect all
- Action Hotkeys
  - **E** to archive
- Interface Hotkeys
  - **F** to open/close the filters
  - **Ctrl / Cmd + F** to focus on the find input
- Help Hotkeys
  - **H** or **?** to show help
- Shortcuts
  - **Number keys** to open the corresponding top-level menu item

---

**Made with ❤️ for Amplience users**
