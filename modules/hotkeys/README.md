[< Back](../../README.md)

# Hotkeys Module

Adds keyboard shortcuts to Amplience Dynamic Content pages. This module is part of the `amplience-patches` extension and can be toggled from popup/options.

## Features

- Keyboard shortcuts for common actions in Amplience
- Quick navigation to top-level menu items with number keys
- Built-in help overlay for discovering shortcuts
- Input-aware behavior to avoid accidental actions while typing

## Enable Or Disable

Use either:

- Extension popup: toggle **Enable Hotkeys**
- Extension options page: toggle **Enable Hotkeys**

The setting key is `hotkeysEnabled` in `chrome.storage.sync`.

## Available Hotkeys

### Global

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

### Listing Page

|     | Actions                               |
| --- | ------------------------------------- |
| A   | Assign a user to selected Items       |
| C   | Create a content item                 |
| D   | Duplicate selected items              |
| E   | Archive selected items                |
| L   | Localize selected items               |
| P   | Publish selected items                |
| U   | Unpublish or Unarchive selected items |

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

### Editor Page

|                  | Actions                     |
| ---------------- | --------------------------- |
| A                | Assign a user               |
| D                | Set delivery key            |
| E                | Archive item                |
| L                | Localize item               |
| P                | Publish item                |
| U                | Unpublish or Unarchive item |
| Ctrl + S         | Save                        |
| Ctrl + Shift + S | Save as...                  |
| Esc              | Cancel editing              |

|     | Interface                     |
| --- | ----------------------------- |
| H   | Show/hide History panel       |
| I   | Show/hide Info (props) panel  |
| S   | Show/hide Scheduling panel    |
| V   | Show/hide Visualization panel |

## Usage Tips

- Press `?` anytime to open the full shortcut overlay.
- In listings, press `F` to open filters, then type letters to quickly narrow content-type filter options.
- Hotkeys are disabled while typing in form fields (except specific keys such as Enter/Ctrl/Cmd combos where relevant).

## Development

### Project Structure

```
modules/hotkeys/
├── hotkeys.js          # Main content script with hotkey logic
└── README.md           # This file
```

### Adding New Hotkeys

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
